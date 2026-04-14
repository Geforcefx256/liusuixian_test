## Context

The current backend MML schema path is a hardcoded stub that returns a small in-memory command catalog for a few network-version combinations. That is enough for the current table-view prototype, but it does not reflect the real Excel rule workbooks already maintained for each network type and version, and it does not carry enough semantics to drive Monaco-style text assistance.

This change is cross-cutting:

- backend startup must import fixed Excel rule workbooks
- backend runtime must query a dedicated rule database rather than a stub constant
- the files route must keep the current `/agent/api/files/mml-schema` contract while exposing richer metadata
- the workbench must use one shared rule schema in both MML table view and MML text view
- Monaco text editing must gain schema-driven completion, hover help, and diagnostics without becoming the source of truth for file content

The existing workbench spec already requires Monaco for MML text view and a workbook shell for MML table view. The missing piece is one authoritative rule source that can serve both surfaces.

## Goals / Non-Goals

**Goals:**
- Make fixed backend Excel workbooks the primary MML rule source for `networkType + networkVersion`.
- Import workbook data into a dedicated SQLite rule database so runtime lookup does not depend on reading Excel files per request.
- Preserve the existing `/agent/api/files/mml-schema` route and keep current table-view-compatible fields intact.
- Extend the returned schema so Monaco text editing can use the same data for completion and diagnostics.
- Keep the current workbook-style MML table model, including summary sheet behavior and text-first rewrite authority.
- Enable richer table-mode behavior for typed parameters so spreadsheet cells can use schema-aware editors and validation rules such as enum-only dropdown selection, integer bounds, and template-guided composite flag-set value generation.
- Centralize frontend MML semantics so table projection and text assistance do not drift.

**Non-Goals:**
- Reintroducing the old external schema API as part of this change.
- Building a full language server or separate MML IDE backend.
- Replacing MML text as the document authority during table edits or Monaco edits.
- Delivering a custom bitfield-only grid widget in the first iteration.
- Allowing user-uploaded Excel rule workbooks through the existing workspace upload route.

## Decisions

### Decision: Use a dedicated SQLite rule database instead of request-time Excel parsing

The backend will import fixed Excel rule workbooks into a dedicated SQLite database such as `data/mml-rules.db`, separate from the existing memory index database.

Rationale:
- runtime schema lookups stay fast and deterministic
- import can be made transactional and checksum-aware
- richer rule metadata becomes queryable and testable without reparsing workbook files per request
- rule ingestion lifecycle stays separate from memory indexing lifecycle

Alternatives considered:
- read Excel directly during every `/files/mml-schema` request
- fold rule tables into the existing `memory.db`

Why not:
- request-time parsing adds latency, file IO, and harder failure handling
- mixing rule data into `memory.db` couples unrelated lifecycles and makes rebuild and rollback more awkward

### Decision: Preserve the existing schema route and extend parameter payloads compatibly

The runtime will keep `/agent/api/files/mml-schema` as the workbench lookup route and will continue returning the current table-view-compatible fields while adding optional richer fields for text assistance and later validation.

Rationale:
- current workbench table projection already depends on that route and field shape
- a compatible extension keeps the workbook path stable while unlocking Monaco assistance
- both consumers can share one schema load path

Alternatives considered:
- add a second text-only rule endpoint
- replace the current payload shape entirely

Why not:
- two endpoints would split semantics and invite drift
- replacing the payload shape would create unnecessary frontend churn for the existing table path

### Decision: Keep workbook table mode conservative but type-aware

The workbook table path will keep its current text-first rewrite model, but known typed parameters will use schema-aware editing behavior where the current grid engine can support it. Enum parameters will use dropdown editing constrained to schema enum values, integer parameters will use numeric validation rules derived from schema constraints, and composite flag-set parameters such as TLS cipher or protocol lists will use a template-guided editor that lets users toggle declared options on or off and then serializes the enabled options back into canonical `NAME&OTHER` style text instead of requiring fully manual text entry.

Rationale:
- users expect typed spreadsheet cells to reflect the same domain rules that the text editor now exposes
- enum-constrained and schema-bounded edits can be enforced without changing the underlying document-authority model
- composite flag-set strings are hard to author correctly by hand, especially for long TLS-style lists, so a template-guided editor reduces error rate without needing a fully separate table engine
- this improves table safety without requiring a new standalone MML table engine

Alternatives considered:
- keep the current workbook table mode limited to thin `select` vs `text` rendering only
- move all richer validation to Monaco text mode and leave the table path permissive
- treat bitfields as plain validated text only

Why not:
- a permissive workbook path would diverge from the richer imported schema and allow invalid values that the product already knows how to reject
- users would see inconsistent behavior between text mode and table mode for the same rule set
- plain validated text is still too hard for non-expert users to compose reliably for composite flag-set parameters

### Decision: Represent workbook composite flag-set editing as a structured in-cell editor with stable serialization

Composite flag-set parameters in workbook mode will open a structured editing surface derived from the declared option list. The user will choose an enabled or disabled state for each declared option, and the workbench will serialize the result back to canonical MML text in stable schema order by joining only the enabled options with `&`.

Rationale:
- users need to see the full declared option set rather than infer hidden positions from a raw string
- stable serialization order avoids noisy text rewrites and keeps round-tripping predictable
- the editor can remain workbook-scoped while still preserving text as the final authority

Alternatives considered:
- use a free-text input with helper placeholder text
- open a separate page-level composite editor outside the grid

Why not:
- placeholder text does not materially reduce composition errors for long option lists such as TLS cipher suites
- a detached form would add navigation cost and break the spreadsheet editing flow

Low-fidelity interaction shape:

Table mode cell:
```text
+------------------------------------------------------+
| CIPHER                                               |
| TLS_AES_128_GCM_SHA256&TLS_AES_256_GCM_SHA384        |
+------------------------------------------------------+
```

Selecting the cell opens a workbook-scoped structured editor:
```text
┌ Edit CIPHER ─────────────────────────────────────────┐
│ TLS_AES_128_GCM_SHA256                      [On]     │
│ TLS_AES_256_GCM_SHA384                      [On]     │
│ TLS_CHACHA20_POLY1305_SHA256               [Off]     │
│ ...                                                  │
│                                                      │
│ Preview: TLS_AES_128_GCM_SHA256&...                  │
│                                                      │
│ [Enable All] [Disable All]                           │
│ [Cancel]                                  [Apply]    │
└──────────────────────────────────────────────────────┘
```

Rules:
- option order in the editor matches schema order exactly
- preview updates immediately as toggles change
- `Enable All` turns every declared option on for the current parameter
- `Disable All` turns every declared option off for the current parameter
- apply rewrites only the targeted parameter value in canonical schema order
- serialization outputs only enabled options, joined by `&`, in schema order
- cancel leaves the backing MML text untouched

### Decision: Expose the same composite flag-set editor affordance in text mode through Monaco actions

For composite flag-set parameters in Monaco text view, the workbench will support normal completion and hover help, but it will also expose a structured edit affordance when the cursor is inside the parameter value. That structured action will open the same option-driven editor model used by workbook mode and then replace only the current value text when applied.

Rationale:
- long composite values such as TLS cipher lists are too cumbersome for completion-only editing
- using the same option-driven editor model in both text and table mode keeps behavior consistent
- replacing only the active value preserves the text-first document authority model and avoids hidden editor-local state

Alternatives considered:
- rely on snippets and completion only for text mode
- support the structured editor only in workbook mode

Why not:
- snippets do not scale well to long option lists
- hiding the structured editor from text mode would make the safer editing path unavailable to users who stay in Monaco

Low-fidelity interaction shape:

Text mode with cursor inside a composite value:
```text
DD TLSPARA: ..., PROTOCAL=TLS1_2&TLS1_3, ...
                    ^
                    cursor here
```

Monaco affordance:
```text
[Edit Composite Value]
```

Structured action:
```text
┌ Edit PROTOCAL ─────────────────────────────┐
│ TLS1_2                            [On]     │
│ TLS1_3                            [On]     │
│                                            │
│ Preview: TLS1_2&TLS1_3                      │
│                                            │
│ [Cancel]                       [Apply]     │
└────────────────────────────────────────────┘
```

Rules:
- apply replaces only the current parameter value text
- serialization uses canonical schema order and outputs only enabled options joined by `&`
- diagnostics continue to validate manually typed values for the same parameter type

### Decision: Treat Monaco text view and workbook table view as two consumers of one frontend MML semantic layer

The frontend will extract and share MML parsing helpers used to identify statements, command heads, parameters, and cursor context so that Monaco completion and workbook projection evaluate the same text structure.

Rationale:
- one parser avoids text/table mismatches around duplicate parameters, unknown keys, and command normalization
- completion ranking and diagnostics can reuse the same parsed statement state that workbook editability already depends on
- this keeps text mode and table mode behavior aligned as richer rules are introduced

Alternatives considered:
- keep the current workbook parser and write separate Monaco-only heuristics

Why not:
- separate parsers would diverge quickly, especially around partial statements and validation messaging

### Decision: Model conditional Excel rules as normalized OR groups by default

Excel condition JSON such as `{"1=A":"必选","1=NAPTR":"必选"}` will be normalized into one condition group with `matchMode = any` and one clause per map entry.

Rationale:
- the provided rule examples describe alternate triggers for the same conditional effect, which is naturally OR-shaped
- a normalized representation is easier to query, document, and consume in completion and diagnostics
- this leaves room for future expansion if the workbook format later introduces explicit AND semantics

Alternatives considered:
- keep condition values as opaque raw JSON only
- infer AND semantics from repeated condition entries

Why not:
- raw JSON alone is hard to query and evaluate in editor assistance
- AND semantics do not match the current example shape

## Risks / Trade-offs

- [Excel parsing dependency adds runtime and build complexity] → Keep the dependency limited to backend import code and cover dist/runtime packaging explicitly.
- [Richer schema fields could be ignored by one frontend surface and used by another] → Define one shared frontend semantic layer and keep both text and table flows loading the same schema payload.
- [Conditional rules may later need more expressive logic than the first importer supports] → Preserve raw condition JSON alongside normalized clause data so later parser upgrades do not lose source information.
- [Startup import failures could block the product unexpectedly] → Make startup import behavior configurable and log clear import errors even when startup continues.
- [Composite flag-set editor complexity may exceed the first grid iteration] → Start with a template-guided editor that generates valid serialized text from declared options, and defer more elaborate custom widgets until the shared schema path is stable.
- [Composite flag-set editor could serialize values inconsistently across edits] → Always serialize in schema-declared option order and treat the serialized text as the only persisted representation.
- [Text-mode structured edit could drift from workbook-mode behavior] → Reuse the same option model, preview generation, and serialization rules in both surfaces.

## Migration Plan

1. Add config support for a fixed MML rule source directory and dedicated rule DB path.
2. Introduce the rule DB schema, importer, checksum tracking, and startup bootstrap.
3. Replace hardcoded runtime schema lookup with DB-backed schema assembly behind the existing files route.
4. Extend frontend schema types and load the richer metadata without breaking current workbook projection.
5. Extract shared MML parsing utilities and wire Monaco completion/diagnostics to the shared rule schema.
6. Keep current workbook table projection active, but point it at the imported rule schema instead of the stub.

Rollback strategy:
- disable startup import and revert the route back to the old stub implementation together
- because imported rules live in a dedicated DB, rollback does not require touching the existing memory DB

## Open Questions

- None for this proposal scope. The current decision is to treat backend Excel workbooks as the primary rule source, use OR semantics for the provided conditional JSON shape, and support both Monaco text assistance and workbook table projection through one shared schema contract.
