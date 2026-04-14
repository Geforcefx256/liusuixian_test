## 1. Workbook shell alignment

- [x] 1.1 Refine the MML workbook tab strip in `WorkspaceEditorPane.vue` so `汇总` and command sheets render as worksheet-style tabs instead of pill-style navigation controls.
- [x] 1.2 Update the active MML sheet container styling so the tab strip and sheet body read as one connected workbook surface rather than as separate stacked cards.
- [x] 1.3 Restyle the `汇总` sheet outer shell so it preserves the same workbook-level visual language as command-sheet views while keeping its existing custom content model.

## 2. Grid surface coordination

- [x] 2.1 Adjust `MmlWorkbookGrid.vue` theme overrides so grid borders, header treatment, and surrounding surface align with the revised workbook shell.
- [x] 2.2 Verify that the revised workbook presentation keeps the existing bottom status bar visually coherent with the tab strip and active sheet surface without changing its behavior.

## 3. Verification

- [x] 3.1 Update `WorkspaceEditorPane` rendering tests or source-backed style assertions to cover worksheet-style tab presentation and connected workbook-shell structure.
- [x] 3.2 Add or update coverage for `汇总` versus command-sheet rendering so both views remain inside the same workbook-shell presentation model.
- [x] 3.3 Verify that the visual refactor does not change active-sheet switching, grid editing flows, status messaging, or text-authoritative save behavior.
