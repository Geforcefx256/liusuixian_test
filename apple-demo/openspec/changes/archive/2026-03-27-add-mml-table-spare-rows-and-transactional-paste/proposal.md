## Why

The current MML workbook table view can only project and edit statements that already exist in source text. That keeps the text-first rewrite path conservative, but it breaks a core operator workflow: users often copy multiple rows from Excel or another spreadsheet and expect to paste them directly into the active MML command sheet, even when the pasted range extends beyond the currently existing rows.

Today that workflow fails for structural reasons rather than because of a small UI defect. The grid renders only persisted statement rows, the active paste path rejects any target range that extends past those rows, and the text rewrite model has no concept of materializing new rows into new MML statements. The result is a workbook surface that looks spreadsheet-like but cannot support spreadsheet-style bulk entry.

The next step is therefore to extend MML table mode from "edit existing statements" to "transactionally update existing statements and create new statements from spreadsheet input" while preserving text as the only saved document authority.

## What Changes

- Add spreadsheet-style spare rows to each MML command sheet so the grid always exposes a visible empty paste region instead of stopping at the last persisted statement row.
- Treat spare rows as view-only placeholders and, in the first release, allow them to materialize new MML statements only through validated spreadsheet paste rather than through direct single-cell typing.
- Replace the current "paste must stay within existing rows" rule with a transactional paste flow that can update persisted rows and create additional rows in one operation when the pasted range extends into spare rows.
- Keep paste behavior all-or-nothing: if any targeted persisted row is blocked, any new row cannot be materialized safely, or any pasted value fails schema validation, the entire paste must be rejected and the underlying MML text must remain unchanged.
- Treat blank pasted cells during new-row materialization as "not provided" values so schema defaults and required-field rules can be evaluated deterministically.
- Keep clipboard semantics canonical for schema-driven special types: enum cells copy and paste their normalized schema values, and composite/bitfield cells copy and paste canonical serialized values that are revalidated and normalized against the target column schema.
- Append newly created statements immediately after the last matching persisted statement in the active command sheet and before any consecutive trailing raw segment rather than introducing freeform row insertion semantics or a second workbook authority.
- Preserve the existing conservative text-first save model, including unchanged comments, blank lines, unaffected statements, and existing read-only fallback rules for unsafe rows.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-web-workbench`: extend MML workbook table mode so command sheets expose spare rows, accept transactional multi-row paste beyond the current persisted row count, and materialize valid spreadsheet input into appended MML statements while preserving text-authoritative save behavior.

## Impact

- `apps/web/src/components/workbench/MmlWorkbookGrid.vue` and related workbook UI state, because the rendered grid model must distinguish persisted rows from spare rows and allow paste to target both.
- `apps/web/src/components/workbench/mmlWorkbook.ts` and shared MML semantic helpers, because the workbench needs new draft-row materialization, canonical value normalization, transactional paste planning, and command-block append logic in addition to the current cell-edit rewrite path.
- `apps/web/src/components/workbench/WorkspaceEditorPane.vue` status feedback and selection messaging, because the workbench should distinguish updating existing rows from creating new rows and must explain spare-row behavior clearly in the workbook status bar.
- Frontend tests covering MML workbook rendering, paste validation, enum/composite canonicalization, new-statement append behavior, and all-or-nothing failure handling.
- OpenSpec requirements in `openspec/specs/agent-web-workbench/spec.md`, especially around spreadsheet interaction semantics, read-only fallback behavior, and text-authoritative MML round-tripping.
