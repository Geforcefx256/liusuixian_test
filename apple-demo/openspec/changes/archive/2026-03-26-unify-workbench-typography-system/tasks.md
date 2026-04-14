## 1. Govern Shared Typography Tokens

- [x] 1.1 Add shared font-family, font-size, and line-height tokens for UI, editor, table, and Markdown surfaces in `apps/web/src/styles.css`.
- [x] 1.2 Normalize shared chrome utilities such as panel eyebrows, segmented controls, agent identity copy, and workspace action buttons to the governed token set.
- [x] 1.3 Remove deprecated small typography variants such as `10px`, `15px`, `17px`, and the current narrow small-size `clamp(...)` set from normal workbench chrome.

## 2. Align Workbench UI Surfaces

- [x] 2.1 Update high-frequency workbench components such as `ConversationPane`, `HomeStage`, `SessionRail`, `WorkspaceSidebar`, `WorkspaceContextPane`, and `WorkbenchShell` to use the governed UI roles.
- [x] 2.2 Update admin and drawer surfaces such as `AdminSkillManagement`, `UserManagementDrawer`, and `HeaderUserMenu` to use the same governed hierarchy.
- [x] 2.3 Keep Markdown preview on its scoped document scale without letting document heading sizes leak into shell chrome.

## 3. Align Editor And Table Surfaces

- [x] 3.1 Keep Monaco and textarea fallback on the governed editor typography rule: monospace `13px / 1.6`.
- [x] 3.2 Update native workspace table view, protocol tables, rich result tables, and MML workbook grid to use the governed table typography rule: UI sans `13px / 1.5` with `12px` support text.
- [x] 3.3 Ensure table editing inputs keep the same typography role as table browsing text so edit state does not visually jump.
- [x] 3.4 Verify vendor styling from `jspreadsheet` and `jsuites` does not reintroduce conflicting font-size behavior in active workbench flows.

## 4. Verification

- [x] 4.1 Add or update frontend tests where typography token usage or class output is part of the component contract.
- [x] 4.2 Verify the workbench at common desktop widths and laptop-class constrained widths to confirm hierarchy consistency across shell, editor, and table surfaces.
- [x] 4.3 Verify that Markdown preview, Monaco, native tables, and MML workbook grid each remain readable while still feeling like one product.
