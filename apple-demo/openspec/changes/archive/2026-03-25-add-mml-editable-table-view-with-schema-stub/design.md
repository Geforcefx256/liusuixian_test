> Note: This design captured the first-pass stub workbook direction for the completed change. The later follow-up `realign-mml-workbook-with-summary-sheet-and-jspreadsheet-ce` supersedes the earlier assumptions about how the summary surface and active grid engine should be realized in the frontend.

## Context

The current workspace already supports opening MML files as text-backed documents, highlighting MML syntax in Monaco, and projecting the standard leading header comment into `网元类型` and `网元版本`. That gives users a workable text correction surface, but it does not yet provide the workbook-style MML table view implied by `index-v10`, where command-oriented MML can be reviewed as grouped sheets and edited at the parameter level.

At the same time, the surrounding workbench shell already has a meaningful user-centered structure: the session rail sits to the left of the file workspace, and the file workspace sits before the right-side context pane. The MML workbook should strengthen that central file-workspace surface rather than introduce a competing layout or blur the distinction between conversation and file editing.

This feature is not just a UI toggle. MML files are still text documents with comments, blank lines, command order, and occasionally irregular statements. A table view that serializes the entire file from scratch would risk destroying those details. The system therefore needs a structured projection that remains subordinate to source text and a save path that rewrites only the statements that were safely edited.

The desired editing behavior also depends on command schema keyed by `networkType` and `networkVersion`, but the real upstream schema interface is not available yet. To avoid blocking the workbench model on an external dependency, this change will introduce an internal schema boundary with normalized stub responses first. That allows the team to validate the sheet model, row safety rules, and statement-level rewrite strategy before wiring the real upstream contract.

## Goals / Non-Goals

**Goals:**
- Add an `index-v10`-style MML workbook view with summary, sheet tabs, and table editing for safe rows.
- Keep the MML workbook inside the existing central file workspace, with the conversation rail remaining to its left.
- Keep MML text as the only authoritative document source.
- Parse MML into a reusable structured projection that supports both rendering and safe rewrites.
- Use `networkType + networkVersion` to load command parameter schema through an internal API boundary.
- Keep `网元类型` and `网元版本` as separate visible controls in the workbench toolbar while hiding internal schema and parse-model concepts from end users.
- Keep the sheet page close to an Excel-like interaction model so the grid remains the primary focus rather than surrounding explanation chrome.
- Use schema to drive known parameter ordering, control choice, serialization defaults, and editability.
- Degrade conservatively to read-only rows whenever structure is not safe to rewrite.
- Preserve comments, blank lines, untouched statements, and unknown raw segments during save.
- Validate the workflow with stubbed schema data before the real upstream schema service exists.

**Non-Goals:**
- Integrating the real upstream schema service in this change.
- Whole-file regeneration or full-document formatting.
- Editing unknown parameters in the table view.
- Row insertion, row deletion, or sheet authoring.
- Reworking the workbench shell into a new conversation-or-editor page structure.
- Solving every malformed or vendor-specific MML syntax case.
- Executing row-level actions directly from the table view.
- Introducing additional spreadsheet/grid third-party libraries beyond `exceljs`.

## Decisions

### Decision: Treat the MML table view as a structured projection of text, not as a second document authority

The source of truth remains `content` plus the existing header metadata projection. The table view is an interpretation of that text and must always be able to reconstruct its edits back into the same text document without replacing the overall file model.

Rationale:
- The current workspace save contract is text-first and already authoritative.
- The product must preserve comments, spacing, and non-structured text.
- Maintaining one authority avoids divergence between text and table state.

Alternatives considered:
- Store and save an independent workbook-style MML data model.

Why not:
- That would create a second source of truth, complicate sync with text view, and increase the risk of losing original authoring details.

### Decision: Keep the workbook in the existing file workspace and preserve the shell's left-to-right UCD

The MML workbook will live inside the current file editor region. The session rail remains to the left of the file workspace, and the right context pane remains a separate side surface. The table feature does not introduce a new top-vs-bottom split between conversation and files.

Rationale:
- The current shell already communicates a clear mental model of conversation on the left, file work in the center, and workspace context on the right.
- Users should experience the table view as a stronger file-editing mode, not as a separate application mode.
- This aligns the feature with `index-v10` without forcing a broader shell redesign.

Alternatives considered:
- Combine conversation and file editing into a vertically stacked central stage.
- Expand the workbook to take over the broader workbench layout.

Why not:
- Those approaches weaken the current task flow and make the MML table feel more disruptive than additive.

### Decision: Model sheets by full command head before `:`

Each table sheet will represent the full command head before the first `:`. For example, `BAK CFGFILE` and `RMV CFGFILE` are distinct sheets even if they act on related entities.

Rationale:
- This matches the workbook mental model already shown in `index-v10`.
- Users read Huawei-style MML commands primarily by complete command head.
- It aligns with the existing MML tokenizer direction, which treats the full command head as the main structural unit.

Alternatives considered:
- Split sheets by verb only or by object only.
- Use one flat table for the entire document.

Why not:
- Those approaches weaken command grouping and would create less meaningful navigation for real operator workflows.

### Decision: Represent each row as one complete MML statement

A row in the MML grid will map to exactly one parsed MML statement. Table columns represent parameters extracted from that statement.

Rationale:
- This gives a clean round-trip target for save behavior.
- It limits the rewrite surface to one statement at a time.
- It makes read-only fallback easier when parsing is uncertain.

Alternatives considered:
- Collapse multiple related statements into one row.
- Treat arbitrary visual lines as rows.

Why not:
- Those approaches do not round-trip cleanly back into text and would make safe rewrites much harder.

### Decision: Keep `网元类型` and `网元版本` as separate visible controls while hiding internal modeling

The workbench toolbar will continue to expose `网元类型` and `网元版本` as distinct user-facing fields. Internally they still drive schema lookup and document metadata, but the UI should not expose internal terms such as schema stub contracts, parse states, or metadata models.

Rationale:
- The current workbench already has an understandable place for these two fields.
- Combining them into a new synthetic control would add interaction complexity without improving clarity.
- Users understand the network context they are setting, but they should not need to learn the internal data model that consumes it.

Alternatives considered:
- Merge the two fields into a single "适用网元" control.
- Hide both fields and infer all schema context automatically.

Why not:
- Merging changes a familiar toolbar pattern without enough benefit.
- Full inference is not reliable enough for this change and would remove an important explicit context control.

### Decision: Use conservative row safety and make uncertain rows read-only

The table view will only permit editing on rows whose statement structure is fully understood and safe to rewrite. If a row contains unknown parameters, duplicate parameters, parse ambiguity, unsupported syntax, or unclear comment binding, the entire row becomes read-only and the user must switch to text view to modify it.

Rationale:
- The user explicitly prefers conservative row editability over risky rewriting.
- The primary risk in this feature is losing or corrupting source text.
- Read-only fallback is acceptable because text view remains available.

Alternatives considered:
- Allow partial cell-level editing even when some parts of the row are uncertain.

Why not:
- Partial editability would still require high-confidence reinsertion of untouched uncertain fragments and would significantly increase save complexity in the first iteration.

### Decision: Keep the sheet page visually close to an Excel-like surface

The active sheet page should stay close to the `index-v10` workbook surface: sheet tabs, grid, and bottom status bar. The sheet body should not add extra explanatory headers, summary cards, or instructional panels that distract from spreadsheet-like operation.

Rationale:
- Users expect sheet interaction to feel similar to Excel once they leave the summary page and enter a command sheet.
- The grid should remain the dominant visual and interaction surface.
- Additional chrome above the grid makes the sheet feel more like a dashboard than a workbook.

Alternatives considered:
- Add prominent summary banners or inline explanation cards above each sheet grid.
- Add a dedicated row-status column for explanatory text in the main grid.

Why not:
- Those additions reduce information density and drift away from the desired spreadsheet mental model.
- Status-heavy layouts belong in the summary page and status bar, not in the core sheet surface.

### Decision: Unknown parameters remain visible but are not editable in table view

If a parsed statement contains parameters that do not exist in the loaded schema for that command, those parameters remain visible in the grid so the user can understand the full row, but the row is read-only and must be edited in text view.

Rationale:
- The user wants unknown parameters to be visible but not table-editable.
- Hiding them would make the grid misleading.
- Allowing edits around them would complicate safe rewrites.

Alternatives considered:
- Hide unknown parameters.
- Allow editing known parameters while preserving unknown parameters in place.

Why not:
- Hiding loses critical context.
- Mixed editability raises rewrite complexity and is unnecessary for the first pass.

### Decision: Surface editability summaries in the bottom status bar before adding more page chrome

Sheet-level editability summaries such as editable-row counts, read-only-row counts, active-cell coordinates, and save state should primarily live in the bottom status bar. When a read-only row is active, the status bar can also carry the user-facing fallback hint to switch back to text view.

Rationale:
- This preserves an Excel-like primary surface where the grid remains central.
- It still gives users continuous situational awareness without adding banners above the table.
- The status bar is already an appropriate place for workbook state and selection feedback.

Alternatives considered:
- Add a persistent explanation strip above the sheet grid.
- Add a separate informational panel inside each sheet page.

Why not:
- Those patterns consume vertical space and dilute the spreadsheet feel.

### Decision: Empty cells mean parameter deletion

When the user clears a cell for an existing parameter, that parameter is removed from the statement rather than being serialized as an empty string.

Rationale:
- This behavior was explicitly chosen by the user.
- It creates a clear and consistent edit rule.
- It avoids conflating "parameter absent" with `PARAM=""`.

Alternatives considered:
- Serialize cleared cells as empty quoted strings.

Why not:
- That changes command semantics and conflicts with the chosen product rule.

### Decision: New parameter insertion follows `orderParamId` strictly

When a new known parameter is added to a statement through the grid, the serializer will place it according to schema `orderParamId`, not merely append it at the end.

Rationale:
- The user explicitly prefers strict `orderParamId`.
- This gives predictable command ordering and better schema alignment.
- It avoids arbitrary insertion drift across sessions.

Alternatives considered:
- Append new parameters to the end of the statement.

Why not:
- That would weaken schema-driven structure and create inconsistent output ordering.

### Decision: Existing parameters preserve original token style whenever possible

If a parameter already exists in source text, edits to its value should preserve its original token style where possible. For example, quoted strings remain quoted and bareword enums remain barewords when the replacement value is valid for that shape.

Rationale:
- Preserving local style reduces rewrite noise.
- It keeps edited statements closer to the original authoring form.
- It supports the broader non-destructive save goal.

Alternatives considered:
- Normalize all edited values into one canonical serialization style.

Why not:
- Canonical rewriting would produce larger diffs and make edited files feel unexpectedly reformatted.

### Decision: Schema access goes through an internal normalized API with stubbed data first

The frontend will call a stable internal MML schema API keyed by `networkType` and `networkVersion`. During this change the backend will provide normalized stub data instead of calling the real upstream service.

Rationale:
- The upstream interface is not available yet.
- The frontend still needs a stable contract to build against.
- Normalization logic belongs close to the adapter boundary so malformed or duplicated upstream-like payloads do not leak into UI code.

Alternatives considered:
- Block the feature until the real upstream service exists.
- Let the frontend consume raw external payloads directly once available.

Why not:
- Waiting would block the table model and rewrite work.
- Direct frontend dependency on raw external payloads would create a brittle coupling.

### Decision: Merge repeated schema command entries by `commandName`, then `paramName`

The internal schema adapter must merge duplicate command entries and duplicate parameters under the same command before returning schema to the frontend.

Rationale:
- The user provided a realistic upstream-like payload shape where the same command can appear multiple times.
- The grid model requires one stable schema per command.
- Parameter-level merge is a straightforward way to tolerate duplicated command blocks.

Alternatives considered:
- Last-write-wins or first-write-wins command replacement.

Why not:
- Replacing entire command entries would discard valid parameter metadata that happened to arrive in another duplicated block.

### Decision: Save uses statement-level non-destructive patching instead of full-file regeneration

When the user saves grid edits, the system will locate each edited statement in the original document, serialize only that statement's updated parameter list, and replace only that statement range. All detached raw segments, blank lines, unrelated comments, untouched statements, and original ordering remain unchanged.

Rationale:
- The user explicitly wants to avoid destructive overwrites that lose comments.
- Statement-level patching is the smallest useful rewrite surface.
- It keeps text view and table view behavior aligned.

Alternatives considered:
- Re-emit the full file from parsed sheets and rows.

Why not:
- Whole-file regeneration would risk reordering, reformatting, or dropping content that was not table-editable.

### Decision: Comment binding uses simple, explicit rules

Comment binding is required to determine which comments travel with an edited statement. The first implementation will use explicit rules:
- trailing inline comments belong to the current statement
- leading comments directly adjacent to a statement with no blank line belong to the following statement
- comments separated from statements by a blank line are detached raw segments
- if binding cannot be determined confidently, the row becomes read-only

Rationale:
- The serializer needs stable boundaries.
- The user prefers conservative behavior.
- These rules cover the most common operator-authored comment patterns without requiring a full document semantics engine.

Alternatives considered:
- Infer more complex comment ownership heuristics.

Why not:
- More aggressive inference would be harder to validate and more likely to mis-assign comments.

## Data Model

The frontend needs a document model that preserves both structured and raw information. A representative shape is:

- `MmlDocument`
  - `headerMetadata`
  - `segments`
  - `statements`
  - `sheets`
- `MmlSegment`
  - `raw`
  - `statement`
- `MmlStatement`
  - `id`
  - `commandName`
  - `range`
  - `rawText`
  - `parseStatus`
  - `readonlyReason`
  - `params`
  - `unknownParams`
  - `hasDuplicateParams`
  - `originalParamOrder`
  - `leadingComments`
  - `trailingComment`
- `MmlSheet`
  - `commandName`
  - `rowIds`
  - `columns`

The important property is not the exact TypeScript shape but the presence of:
- original text ranges for surgical rewrites
- original parameter order
- token-style information for existing values
- explicit read-only reasons
- explicit distinction between detached raw segments and editable statements

## Schema Contract

The internal schema API should hide raw upstream quirks and return normalized command metadata. The current change will stub this contract, but the response shape should already resemble the future stable form:

- `commands[]`
  - `commandName`
  - `params[]`
    - `paramName`
    - `dataType`
    - `enumValues`
    - `defaultValue`
    - `required`
    - `caseSensitive`
    - `orderParamId`
    - `description`

Normalization responsibilities include:
- merging repeated `commandName`
- merging duplicate `paramName`
- de-duplicating enum values
- correcting upstream-like field inconsistencies such as misspelled defaults
- preserving enough metadata to drive table ordering, edit controls, and serializer defaults

## UI Behavior

### Workbook Surface

The MML table view will follow the current editor shell and should not replace the conversation-led layout. Within the editor pane, the MML table surface will provide:
- a summary screen listing available command sheets
- sheet tabs for opened or selected command groups
- a current sheet grid with one row per MML statement

This mirrors the `index-v10` workbook idea while still living inside the existing workbench editor region.

### Page Information Architecture

The target page structure is:

```text
Workbench shell
├─ session rail
├─ file workspace
│  ├─ file tabs
│  ├─ toolbar
│  │  ├─ text/table toggle
│  │  ├─ file type
│  │  ├─ 网元类型
│  │  ├─ 网元版本
│  │  ├─ save
│  │  └─ continue processing
│  ├─ workbook tabs
│  │  ├─ 汇总
│  │  └─ command sheets
│  ├─ active content
│  │  ├─ text editor
│  │  ├─ summary page
│  │  └─ sheet grid
│  └─ bottom status bar
└─ right context pane
```

Within table view:

```text
Summary page
├─ title + short instruction
├─ search
├─ type filters
└─ sheet list
   └─ each item shows command name, type, row count, and compact editability status

Sheet page
├─ sheet tabs
├─ grid
│  ├─ row numbers
│  ├─ parameter columns
│  └─ active cell / selection styling
└─ bottom status bar
   ├─ active sheet
   ├─ active cell
   ├─ row counts
   ├─ editable vs read-only counts
   └─ save / fallback hint
```

### Editability and Controls

Known parameters should use schema-driven controls where possible:
- enum parameters → select input
- numeric parameters → constrained text input
- free text / string-like parameters → text input

Unknown parameters remain visible but not editable.

Rows that are read-only must present a clear reason, such as:
- contains unknown parameters
- duplicate parameter names
- unsupported statement syntax
- ambiguous comment binding

Those reasons should be translated into user-facing language such as "含未识别内容" or "请切换到文本视图修改" rather than exposing internal parse or schema terms directly in the main UI.

### Schema Loading States

The table view should distinguish:
- `idle`
- `loading`
- `ready`
- `error`
- `unavailable`

Behavior:
- `ready` → schema-driven editing is enabled
- `loading` → show loading state and disable editing
- `error` / `unavailable` → allow projection browsing but degrade to read-only and direct users back to text view for changes

### Spreadsheet Implementation Constraint

The TypeScript implementation for workbook-style modeling and spreadsheet-oriented import/export behavior in this change must use `exceljs` as the only spreadsheet-oriented third-party dependency.

Implications:
- workbook, worksheet, row, and cell concepts may align with `exceljs`
- the browser workbook UI still owns its own rendering and interaction shell
- no additional spreadsheet/grid packages should be introduced for this change

## Serialization Rules

### Existing Parameters

When editing an existing known parameter:
- preserve original value style when possible
- use schema normalization only where necessary, such as canonical enum value selection

### Deleted Parameters

When a cell is cleared:
- remove the parameter entirely from the statement

### Newly Added Parameters

When a known parameter is added:
- place it according to schema `orderParamId`
- serialize the value based on schema type rules
- use quoted form as the conservative fallback if schema type is not specific enough

### Unknown Parameters

Unknown parameters are never created, removed, or edited through the grid in this change.

## Save Flow

The save flow remains text-first:

1. Parse the current MML text into the document model.
2. Apply table edits to the in-memory statement projection.
3. For each edited statement:
   - build the next parameter sequence
   - preserve untouched parameter order where possible
   - insert new parameters by `orderParamId`
   - remove deleted parameters
   - serialize the updated statement text
4. Replace only that statement's original text range in the document.
5. Preserve all detached raw segments, untouched statements, comments, and blank lines.
6. Submit the resulting `content` and existing `mmlMetadata` through the current workspace save path.

This ensures the table editor remains compatible with the current file contract and the existing header-comment metadata behavior.

## Risks / Trade-offs

- [Conservative read-only rules reduce table edit coverage] → This is acceptable in the first pass because text view remains available and the user prefers safety over aggressive editing.
- [Stub schema may diverge from the eventual upstream service] → Keep the adapter boundary explicit and normalize the contract early so only the backend stub/adapter changes later.
- [Statement-level rewrite still risks subtle formatting drift inside edited rows] → Preserve original token style and untouched parameter order where possible, and avoid whole-file serialization entirely.
- [Comment binding edge cases may still exist] → Mark uncertain rows read-only instead of attempting unsafe rewrites.
- [Schema ordering may conflict with existing author order] → Preserve existing order for untouched parameters and apply strict `orderParamId` only when new parameters must be inserted.

## Open Questions

- Whether the first parser should treat some currently unsupported but common syntax forms as editable instead of read-only if real sample files show they are safe enough.
- Whether required-parameter schema should remain advisory in the first pass or eventually block save when a user deletes a required parameter.
- Whether future schema integration should introduce local caching keyed by `networkType + networkVersion` at the backend adapter layer or in the frontend store.
