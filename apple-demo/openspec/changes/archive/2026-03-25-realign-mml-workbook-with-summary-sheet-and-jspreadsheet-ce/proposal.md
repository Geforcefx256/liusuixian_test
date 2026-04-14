## Why

The current MML table view delivers the first structured projection, but its UI has drifted away from the intended workbook model and from the operator expectation shown in `index-v10`: summary content is rendered above the grid instead of as a dedicated leftmost sheet, the sheet body includes dashboard-like chrome, and the native HTML table does not support the core spreadsheet interactions users expect.

The next step is therefore not another small styling pass. The workbench needs a workbook shell that treats `汇总` as a real sheet, keeps command sheets focused on the grid, and upgrades the active MML sheet surface to a spreadsheet-style grid within the product's current dependency constraints.

## What Changes

- Realign the MML table view to an `index-v10`-style workbook shell where `汇总` is a dedicated sheet tab that is always rendered at the far left.
- Remove the current MML summary banner above the table and the separate sheet-card overview so the workbook body follows a simpler `tabs + sheet content + status bar` structure.
- Keep summary content inside the `汇总` sheet and render the active command sheet grid only when a non-summary sheet tab is selected.
- Replace the native HTML MML grid implementation with a `Jspreadsheet CE 4.15`-backed spreadsheet surface for active command sheets instead of continuing to grow a custom `<table>` interaction model.
- Preserve the current text-first MML authority, schema-driven columns, conservative row safety rules, and statement-level non-destructive rewrite behavior while routing spreadsheet edits back through the existing MML projection model.
- Support the spreadsheet interactions that fit within `Jspreadsheet CE 4.15`, including rectangular selection, standard copy/paste, keyboard navigation, and schema-driven dropdown editors for known enum parameters.
- Surface active-sheet, active-selection, and read-only fallback feedback in the bottom workbook status bar rather than in additional page chrome.
- Keep `网元类型` and `网元版本` as shell-owned controls outside the spreadsheet grid.
- Explicitly exclude non-contiguous multi-range selection, row or sheet authoring, full Excel feature parity, and any move away from text as the only saved document authority.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-web-workbench`: refine the MML workbook table experience so it uses a fixed leftmost summary sheet and a spreadsheet-style command-sheet grid with bounded Excel-like interaction semantics.

## Impact

- `apps/web` workspace editor layout, MML workbook state, tab state, status-bar state, and related frontend tests.
- Frontend dependency surface for `Jspreadsheet CE 4.15` and any required companion styles or runtime assets.
- Existing MML projection and rewrite logic in `apps/web` because spreadsheet edits still need to converge through the current text-first `mmlWorkbook` model.
- Existing OpenSpec requirements for `agent-web-workbench`, especially around MML toolbar ownership, workbook interaction, fallback behavior, and text-authoritative save semantics.
