## Context

The current MML workbook table path is intentionally conservative. It parses source text into persisted statements, groups those statements into command sheets, and allows spreadsheet-style edits only when a target cell maps cleanly back to an existing safe statement. That model preserves comments, blank lines, statement order, and other untouched text segments, but it also means the table surface can only operate on rows that already exist in source text.

That limitation now blocks a primary operator workflow. In real spreadsheet use, operators do not expect to create rows one by one before entering values. They copy multiple rows from another sheet and paste them into the current command page. In the current implementation, that operation fails as soon as the paste rectangle extends beyond the existing persisted row count, because:

- the grid renders only persisted statement rows
- the paste path rejects any target row that does not already exist
- the text rewrite path has no abstraction for creating a new statement from spreadsheet input

The result is a mismatch between the spreadsheet mental model and the text-authoritative implementation model. This change resolves that mismatch by introducing spare rows as a grid-only affordance and a transactional materialization path that can turn valid spreadsheet input into new appended MML statements without creating a second document authority.

## Goals / Non-Goals

**Goals:**
- Keep MML text as the only saved document authority while allowing the table surface to create new statements from spreadsheet input.
- Expose visible spare rows in each active MML command sheet so users can paste beyond the current persisted row count.
- Support direct table authoring in spare rows, including partial input that remains local until the row is valid.
- Support transactional multi-row paste that can update existing rows and create additional rows in one operation.
- Preserve all-or-nothing safety semantics for spreadsheet paste.
- Use canonical clipboard semantics for typed schema fields, especially enums and composite/bitfield parameters.
- Append newly created statements to the active command sheet's existing statement block in source text without reformatting unrelated content.
- Keep the current conservative read-only fallback for unsafe persisted rows.

**Non-Goals:**
- Replacing the current text-first MML parse and rewrite model with a workbook-native save authority.
- Allowing partial-success paste where only some rows or cells are applied.
- Supporting freeform row insertion at arbitrary positions inside a command block.
- Supporting creation of entirely new command sheets that do not already have at least one persisted statement in source text.
- Adding fuzzy import modes such as header-based column mapping, label-to-enum alias matching, or permissive bitfield free-text parsing.
- Changing the backend MML schema route or introducing new backend persistence.

## Decisions

### Decision: Separate the persisted workbook model from the rendered grid-row model

The existing `mmlWorkbook` projection will remain the persisted business model. It will continue to represent only rows that correspond to parsed statements in source text. The workbench will add a second grid-oriented view model that extends each active sheet with spare rows for rendering and interaction.

Rationale:
- The persisted workbook model already aligns with the text-authoritative rewrite contract.
- Spare rows are interaction affordances, not persisted document facts.
- Keeping the two layers separate prevents view-only placeholders from contaminating read-only rules, row identity, and statement serialization logic.

Alternatives considered:
- Add spare rows directly into `sheet.rows`.
- Make the grid library's internal spare-row feature the business model.

Why not:
- Mixing placeholders into `sheet.rows` would blur the distinction between persisted and non-persisted rows and complicate every existing edit path.
- Letting the grid library own row semantics would weaken the text-first authority model and make validation harder to reason about.

### Decision: Treat spare rows as table-local new-row state until the row becomes valid

Spare rows remain non-persisted placeholders in the document model, but the table view may attach incomplete new-row state to them as soon as the user types, pastes, or deletes values in those rows. That incomplete state exists only in the table surface for the current workspace session. A spare-row-backed row becomes a real persisted statement only when its explicit table values satisfy required and conditional-required validation and the resulting statement can be appended into source text.

Rationale:
- This preserves the spreadsheet mental model for direct table authoring instead of limiting users to paste-only creation.
- It avoids polluting source text with empty or partially invented statements.
- It keeps the text-authoritative rebuild model intact while allowing users to return to incomplete rows after switching tabs.

Alternatives considered:
- Keep draft candidates transaction-local to paste only.
- Insert empty statements into the text immediately when the grid shows spare rows.
- Auto-fill untouched parameters or schema defaults while the user is authoring a new row.

Why not:
- Paste-only row creation conflicts with the required spreadsheet-style editing experience in table view.
- Writing empty statements into text would violate the current conservative save model and create invalid or misleading MML.
- Auto-filling untouched parameters would cause the workbench to author values the user did not provide and would make partial-column paste behave unpredictably.

### Decision: Make spreadsheet paste atomic for hard validation failures while allowing incomplete new rows to remain local

The paste path will be redesigned as a transaction planner. A single paste operation may contain two kinds of work:

- updates to existing persisted rows
- edits against spare-row-backed new-row state

The workbench will validate the entire rectangle before committing any text changes. If any targeted persisted row is blocked, any targeted value fails column validation, or the paste exceeds the available grid range, the whole operation will be rejected. If spare-row-backed rows remain incomplete after the paste, that is not itself a hard failure; those rows stay in local table state until the user completes or clears them.

Rationale:
- Users need clear trust semantics for spreadsheet operations.
- Existing conservative paste rules already bias toward all-or-nothing behavior for hard validation failures.
- Allowing incomplete new rows to remain local matches spreadsheet expectations without forcing fake parameter values into text.

Alternatives considered:
- Apply valid cells and skip invalid cells silently.
- Reject paste whenever any spare-row-backed row remains incomplete.

Why not:
- Silent partial application would make it hard to understand what was actually saved.
- Treating incompleteness as a hard error would force users back into the same blocked workflow this change is trying to remove.

### Decision: New statements append to the end of the active command block only

Newly created statements will be appended immediately after the last persisted statement in the active sheet's command block and before any consecutive trailing raw segment that currently follows that last matching statement. The first release will not support arbitrary insertion positions inside the block, and it will not support creating rows for commands that do not already exist in source text.

Rationale:
- Appending is deterministic and easy to explain.
- It avoids introducing a new placement model tied to visual row indices that do not map cleanly to text when command statements are interleaved with comments and raw segments.
- Inserting before the consecutive trailing raw segment gives the append rule a precise anchor instead of leaving comment-adjacent placement ambiguous.
- It keeps the rewrite strategy conservative while still solving the bulk-entry workflow.

Alternatives considered:
- Insert new statements adjacent to the currently selected persisted row.
- Infer insertion points from current visual position, comments, or blank-line regions.
- Allow creation for command sheets that have no persisted statements yet.

Why not:
- Selection-relative insertion would produce surprising results when the sheet view no longer matches text locality exactly.
- Comment-aware insertion is feasible later but too ambiguous for the first release.
- Empty-sheet creation requires a broader authoring model than this change intends to introduce.

### Decision: Clipboard values for schema-driven typed cells must be canonical

The workbench will treat clipboard payloads as plain text and interpret each pasted cell according to the target column schema. For special typed cells, the clipboard contract will be canonical:

- enum cells copy and paste normalized schema values
- numeric cells copy and paste numeric text
- composite/bitfield cells copy and paste canonical serialized text

Rationale:
- Clipboard content must round-trip cleanly across repeated copy/paste cycles.
- Canonical clipboard semantics make validation deterministic across grid, text, and external spreadsheet tools.
- This avoids coupling clipboard behavior to UI labels, dropdown labels, or structured editor presentation state.

Alternatives considered:
- Copy display labels for enums instead of stored values.
- Accept multiple freeform textual encodings for composite values during paste.

Why not:
- Label-based copy would break round-tripping and drift from text-authoritative stored values.
- Permissive composite parsing would expand the error surface and make schema-driven guarantees weaker.

### Decision: New-row materialization uses only explicit table values plus required-rule evaluation

When a new row is materialized from table input, the workbench will evaluate only the values explicitly present in that row's table state. Blank cells are treated as "not provided". Required and conditional-required validation determines whether the row is still incomplete or can be serialized into a real statement. The workbench does not seed schema defaults or infer untouched parameter values.

Rationale:
- This keeps the table surface faithful to what the user actually typed or pasted.
- It prevents one-column paste from unexpectedly filling sibling columns.
- It makes validation feedback explicit instead of masking missing parameters with generated values.

Alternatives considered:
- Seed schema defaults before validation.
- Infer values for untouched parameters from other rows or clipboard shape.
- Treat blank pasted cells as explicit empty overrides during new-row creation.

Why not:
- Default seeding and inferred values would make the workbench author parameters the user never supplied.
- Explicit-empty override semantics would make spreadsheet imports brittle and would conflict with the goal of preserving partial authoring state until the user finishes the row.

## Data Model

The current persisted workbook model remains unchanged in principle:

```text
content
  -> parseMmlDocument
  -> buildMmlWorkbook
  -> sheets[].rows = persisted statements only
```

This change adds a second view-model layer for the active grid:

```text
persisted workbook sheet
  -> buildMmlGridSheet
  -> gridRows = persisted rows + spare rows
```

Suggested view-model shape:

```ts
type MmlGridRow =
  | {
      kind: 'persisted'
      id: string
      rowNumber: number
      persistedRowId: string
      values: Record<string, string>
      readOnly: boolean
      readOnlyReasons: string[]
    }
  | {
      kind: 'spare'
      id: string
      rowNumber: number
      values: Record<string, string>
    }
```

This change also adds a table-local incomplete-row overlay for spare-row-backed authoring:

```ts
interface IncompleteMmlRowState {
  fileId: string
  sheetKey: string
  rowNumber: number
  values: Record<string, string>
  invalidCells: Record<string, string>
  missingRequired: string[]
  missingConditionalRequired: string[]
}
```

This keeps the runtime model simpler:
- persisted rows come from source text
- spare rows come from view-model expansion
- incomplete new rows live only in `WorkspaceEditorPane` state for the current workspace session
- only complete valid rows are materialized into source text

## Paste Planning and Commit Flow

The paste algorithm should be explicit and staged.

### Stage 1: Parse clipboard text into a rectangular value matrix

The workbench converts clipboard text into `string[][]` with the existing rectangular spreadsheet assumptions:
- top-left cell alignment only
- no header inference
- no column-name matching
- no sparse mapping

### Stage 2: Map the rectangle onto grid rows and sheet columns

The target rectangle is resolved against the active `MmlGridSheet` rather than against persisted `sheet.rows`.

Each targeted cell falls into one of three categories:
- persisted-row cell
- spare-row cell
- out-of-range cell

Out-of-range cells still fail the paste. Spare-row cells no longer fail by definition.

### Stage 3: Build a transaction plan

The planner produces two logical work sets:

```text
updates:
  edits against existing persisted rows

new-row patches:
  partial values grouped by spare-row target
```

Suggested intermediate representation:

```ts
type CellOperation =
  | {
      kind: 'update-cell'
      rowId: string
      columnKey: string
      rawValue: string
    }
  | {
      kind: 'set-incomplete-row-cell'
      draftRowIndex: number
      columnKey: string
      rawValue: string
    }
```

`set-incomplete-row-cell` operations are grouped by `draftRowIndex` into per-row table state patches before validation.

### Stage 4: Normalize and validate every targeted cell and new-row patch

Validation must happen on the fully planned transaction before any text is changed.

For persisted-row updates:
- existing read-only row rules still apply
- unknown and non-editable columns still block edits
- schema value validation still applies

For spare-row-backed new rows:
- overlay pasted values onto any existing incomplete-row table state for the same row
- treat blank pasted cells as not provided
- normalize each typed value according to the target column
- evaluate unconditional required parameters
- evaluate conditional-required parameters against the candidate row state
- mark rows that still miss required parameters as incomplete instead of treating them as hard failures

### Stage 5: Commit in two steps inside one logical transaction

If validation succeeds, commit proceeds as:

1. Apply all persisted-row updates to produce `contentA`
2. Update local incomplete-row state, materialize any rows that are now complete into statement text, and append those statements to produce `contentB`

The user-visible outcome is still one operation even if internally it is staged.

This sequencing is preferred because:
- persisted-row rewrites already use stable existing logic
- new-row appends can be computed against a predictable post-update content state
- the final source of truth remains a single MML text string

### Stage 6: Rebuild workbook state from canonical text and reconcile local incomplete rows

After commit, the workbench rebuilds the workbook from `contentB`, then rebuilds the grid-sheet view model. Any spare-row-backed rows that were materialized are removed from local incomplete-row state. Rows that remain incomplete stay only in component state and are preserved across file-tab switching, command-tab switching, and text/table view switching within the current workspace session.

Direct single-cell typing into spare rows uses the same local-state and materialization flow as paste.

## Typed Clipboard Semantics

### Enum Columns

Copy behavior:
- copy the canonical enum value, not a display label

Paste behavior:
- validate against the target column's enum set
- optionally apply case normalization only when the schema says the field is not case-sensitive
- write the canonical enum value back into text

### Numeric Columns

Copy behavior:
- copy the numeric text representation

Paste behavior:
- enforce integer or numeric constraints from schema
- reject out-of-range values

### Composite / Bitfield Columns

Copy behavior:
- copy the canonical serialized text representation

Paste behavior:
- parse only supported canonical tokens
- reject undeclared options
- reserialize accepted values into schema order before saving

This keeps copy/paste behavior stable across spreadsheet mode, text mode, and external spreadsheet tools.

## Row Materialization Rules

A row created from spare-row input becomes a statement only if it can be serialized as a valid command-sheet row for the active command.

Materialization sequence:

```text
empty or existing incomplete row
  -> overlay explicit table values
  -> normalize typed values
  -> evaluate required / conditional-required rules
  -> either remain incomplete in table state
  -> or build params in schema order
  -> serializeStatement(commandHead, params)
```

If any required or conditionally required parameter remains unresolved after the explicit table values are applied, the row remains incomplete in table state and is not materialized. Blank pasted cells do not count as explicit parameter-clearing instructions during new-row creation.

## Text Append Strategy

Newly created statements are appended only after the last persisted statement whose `commandHead` matches the active sheet key and before the consecutive raw segment that currently follows that last matching statement, if such a raw segment exists.

Rules:
- preserve the order of newly created statements exactly as they appeared in the pasted rectangle
- preserve untouched comments, blank lines, raw segments, and other command statements
- do not attempt freeform insertion relative to visual selection
- fail the operation if the active sheet has no persisted statement block to anchor the append in the first release; such schema-only empty-sheet authoring is out of scope

This intentionally keeps row creation narrower than full workbook authoring while solving the primary bulk-entry workflow.

## Status and Feedback

The workbook status bar remains the primary feedback surface.

Recommended status messaging:
- selecting a persisted editable cell: `R12 IPTYPE · 可编辑`
- selecting a spare row cell: `R103 · 空白行，可继续填写新语句`
- planning a mixed paste: `将更新 2 行，新增 8 行`
- paste failure: show the first concrete row/column reason
- incomplete new row present: `R103 · 缺少必选参数 NAME`
- save blocked: `存在未完成表格行，补齐或清除后再保存`

Failure messages should stay specific:
- invalid enum
- invalid numeric range
- invalid composite token
- blocked persisted row due to existing read-only reasons

## Risks / Trade-offs

- [Grid view-model layering adds complexity] → Mitigation: keep the persisted workbook model unchanged and isolate spare-row behavior in one dedicated grid-sheet builder.
- [Appending instead of visual-position insertion may surprise some users] → Mitigation: make the append rule explicit in specs and feedback copy; defer richer insertion semantics to a later change.
- [Incomplete rows exist outside persisted text] → Mitigation: keep them local to the current workspace session, highlight them clearly, and block save until they are resolved.
- [Composite clipboard rules may feel strict compared with permissive spreadsheet tools] → Mitigation: keep V1 canonical and deterministic; add looser parsing only in a later change if user data proves it necessary.
- [Rebuilding the workbook after large paste operations could reset selection unexpectedly] → Mitigation: preserve active sheet and restore a predictable selection anchor after commit where feasible.

## Migration Plan

1. Introduce a grid-sheet view model that layers spare rows on top of the current persisted workbook sheet.
2. Add component-local incomplete-row state keyed by file, command sheet, and grid row.
3. Refactor MML paste handling into an explicit transaction planner that can target persisted rows and spare rows together.
4. Extend spare-row authoring so direct typing, paste, and deletion all update the same incomplete-row state.
5. Add explicit-value-only row materialization and command-block append helpers in the frontend MML semantic layer.
6. Update workbook status-bar feedback, save blocking, and tests for incomplete rows, mixed update/insert paste, and canonical enum/composite clipboard behavior.

## Open Questions

- Whether the first release should expose a fixed spare-row count per sheet or dynamically replenish spare rows as the user scrolls toward the bottom.
