## Why

The current MML table view already uses an Excel-like grid surface, but the surrounding workbook shell still reads like product navigation chrome: the sheet tabs are rendered as pill buttons, the sheet body is framed as a separate rounded card, and the summary surface keeps a dashboard-like visual language. That gap is now visible enough to hurt operator trust because the user expectation for this area is "Excel-style worksheet editing", not "regular application tabs above a table widget".

## What Changes

- Realign the MML workbook table shell so the visible hierarchy reads as `worksheet tabs + sheet surface + status bar` instead of `pill tabs + card + grid`.
- Restyle MML sheet tabs to follow Excel-like worksheet semantics, including a lighter inactive state, a sheet-attached active state, and spacing/border treatment that visually connects the tabs to the active sheet.
- Refine the active MML sheet container so the tab strip, summary sheet, command-sheet grid panel, and surrounding borders feel like one workbook surface rather than stacked independent cards.
- Update the `汇总` sheet presentation to use the same workbook surface language as command sheets so switching between `汇总` and command sheets does not feel like leaving the workbook.
- Keep the current MML workbook behavior unchanged: no changes to parsing, grid editing semantics, row safety, paste behavior, status-bar messaging, or text-authoritative save rules.
- Explicitly exclude full Excel feature expansion, sheet management, grid-engine replacement, or broader workbench theme changes beyond the MML workbook shell.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: refine the MML workbook presentation requirements so table-view sheet tabs and sheet surfaces align with an Excel-like worksheet shell while preserving the existing workbook interaction and save semantics.

## Impact

- Affected frontend workbench presentation code, primarily the MML workbook shell in `apps/web/src/components/workbench/WorkspaceEditorPane.vue`.
- Likely affected MML grid theme integration in `apps/web/src/components/workbench/MmlWorkbookGrid.vue` so the grid borders, header treatment, and sheet container visually align with the revised workbook shell.
- Possible adjustments to shared visual tokens or supporting shell styles in `apps/web/src/styles.css` if the existing workbook surface tokens need tighter Excel-like defaults.
- Affected frontend tests covering MML workbook rendering and shell states, especially `WorkspaceEditorPane.test.ts` and any grid-style source assertions.
