## 1. Runtime Schema Semantics

- [x] 1.1 Update Excel-backed MML rule normalization so conditionally required parameters are not promoted into unconditional `required` metadata.
- [x] 1.2 Add runtime tests that cover `条件必选` / `条件可选` workbook rows and verify the returned schema contract preserves conditional trigger semantics without false required flags.

## 2. Frontend Diagnostic Correctness

- [x] 2.1 Update shared MML statement validation so missing-parameter diagnostics are emitted only for truly unconditional required parameters or for conditionally required parameters whose trigger conditions match the active statement.
- [x] 2.2 Add frontend tests that prove valid MML statements do not receive false-positive diagnostics when inactive conditional rules are present.

## 3. Text-View Diagnostic Discoverability

- [x] 3.1 Extend `WorkspaceTextEditor` to expose normalized diagnostics alongside Monaco markers and to prioritize diagnostic content in hover for marked ranges.
- [x] 3.2 Update `WorkspaceEditorPane` to render a text-view diagnostic summary and a collapsed-by-default expandable diagnostic list for active MML files.
- [x] 3.3 Add interaction tests for diagnostic summary rendering, expansion/collapse behavior, and jump-to-diagnostic navigation.

## 4. Verification

- [x] 4.1 Verify the investigated UNC `20.11.2` sample no longer shows false diagnostics in text view.
- [x] 4.2 Verify real unknown-parameter, duplicate-parameter, invalid-enum, and active conditional-required violations still surface through Monaco markers, hover, and the summary/list UI.
