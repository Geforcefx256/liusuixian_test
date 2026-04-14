## 1. Editor Header And MML Mode Entry

- [x] 1.1 Rework `WorkspaceEditorPane` so the primary toolbar contains only view switching, the `按 MML 解析` summary entry, save state, and save action.
- [x] 1.2 Remove the user-facing `类型 MML` display and `继续处理` action from the editor header and update any component wiring that depends on them.
- [x] 1.3 Add the expandable MML configuration area for `网元类型` and `网元版本`, shown from the summary entry and hidden from the primary toolbar row.
- [x] 1.4 Make the `按 MML 解析` entry appear for supported `txt` files and route activation through the existing MML save/model behavior.
- [x] 1.5 Replace user-visible technical status wording with task-oriented copy for unconfigured, ready, loading, and temporarily unavailable MML/table-view states.

## 2. Workspace Shell Width Behavior

- [x] 2.1 Update workspace shell layout tokens and pane sizing so the editor gets priority width in the workspace-expanded state.
- [x] 2.2 Change the right workspace sidebar to yield or collapse before the editor loses its stable primary-toolbar layout.
- [x] 2.3 Rework `SessionRail` expansion so the expanded list opens as an overlay without changing the in-flow workbench width on hover.
- [x] 2.4 Keep re-open and collapse affordances accessible after the right sidebar and left session rail behavior changes.

## 3. Verification

- [x] 3.1 Update `WorkspaceEditorPane` tests to cover `txt` discovery of the `按 MML 解析` entry, expandable MML configuration, and the new blocked-state copy.
- [x] 3.2 Update workbench shell and session rail tests, or add focused coverage, for right-sidebar yield behavior and overlay-based session history expansion.
- [x] 3.3 Run the relevant frontend test suite and verify the workspace-expanded shell keeps a single-line primary toolbar without hover-triggered layout jitter.
