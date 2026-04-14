## 1. Workspace Editor Shell

- [x] 1.1 Update `WorkspaceEditorPane.vue` so text view editing actions default to a compact `搜索` / `保存` / `更多` toolbar layout.
- [x] 1.2 Add inline search-bar state and UI in `WorkspaceEditorPane.vue`, including expand/collapse behavior and a nested replace area with `替换当前` / `全部替换`.
- [x] 1.3 Extend the existing `更多` menu flow for the text view so it can expose a clickable `撤销` action without mixing in out-of-scope actions like `重做` or `跳转到行`.

## 2. Text Editor Command Wiring

- [x] 2.1 Expose current-file search, replace-current, replace-all, and undo command hooks from `WorkspaceTextEditor.vue` for the active Monaco-backed text editor.
- [x] 2.2 Update the Monaco runtime wiring if needed so the required find/replace capabilities are available through the existing editor integration without adding a new dependency.
- [x] 2.3 Ensure the new search/replace/undo actions are only active for supported text-based files in text view and do not claim workspace-wide or table-view scope.

## 3. Verification

- [x] 3.1 Add or update component tests for `WorkspaceEditorPane` to cover compact toolbar visibility, inline search-bar toggling, nested replace controls, and the `更多 -> 撤销` entry.
- [x] 3.2 Add or update `WorkspaceTextEditor` tests to cover search/replace/undo command dispatch behavior for the active text editor instance.
- [x] 3.3 Run the relevant frontend test suite covering the workbench editor pane and text editor behavior.
