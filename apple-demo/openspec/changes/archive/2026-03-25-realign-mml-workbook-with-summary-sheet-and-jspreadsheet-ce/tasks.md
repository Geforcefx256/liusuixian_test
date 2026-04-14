## 1. Workbook Shell Realignment

- [x] 1.1 Replace the current MML summary banner and sheet-card overview with a Vue-managed workbook tab row that keeps `汇总` fixed at the far left.
- [x] 1.2 Implement summary-sheet body rendering so summary content appears only when the `汇总` tab is active and command-sheet grids render only for non-summary tabs.
- [x] 1.3 Update the workbook status bar state model to track active sheet, active selection, and read-only feedback without relying on top-of-grid explanation panels.

## 2. Jspreadsheet CE Grid Integration

- [x] 2.1 Add the `Jspreadsheet CE 4.15` dependency and create a dedicated MML command-sheet adapter component that owns grid mount, teardown, and styling integration.
- [x] 2.2 Map `mmlWorkbook` sheet columns and row values into the spreadsheet grid, including dropdown editors for schema `select` parameters and read-only treatment for non-editable targets.
- [x] 2.3 Wire spreadsheet selection events back into the workbench so the active command-sheet selection is reflected in the bottom status bar.

## 3. Conservative Spreadsheet Edit Pipeline

- [x] 3.1 Route single-cell spreadsheet edits through the existing `applyMmlCellEdit(...)` text-first rewrite path.
- [x] 3.2 Implement conservative rectangular paste handling that validates the full target range before applying edits and rejects blocked ranges without mutating the underlying MML text.
- [x] 3.3 Preserve the current fallback behavior for read-only rows and unknown-parameter rows so spreadsheet interactions never bypass existing MML safety rules.

## 4. Verification

- [x] 4.1 Update workspace editor tests to cover fixed-leftmost `汇总` tabs, summary-vs-grid body switching, and command-sheet tab activation.
- [x] 4.2 Add integration-oriented tests for spreadsheet selection feedback, schema-driven dropdown editing, and text-first content updates from valid spreadsheet edits.
- [x] 4.3 Add tests for blocked edits and blocked paste behavior on read-only rows or unsupported target ranges.
