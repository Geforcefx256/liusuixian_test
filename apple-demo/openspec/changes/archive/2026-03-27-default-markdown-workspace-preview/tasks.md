## 1. Markdown Default View Behavior

- [x] 1.1 Update `WorkspaceEditorPane` so a Markdown file enters `preview` whenever it becomes the active workspace file.
- [x] 1.2 Keep Markdown toolbar switching intact so users can still move between `编辑` and `预览` without changing non-Markdown defaults.

## 2. Regression Coverage

- [x] 2.1 Update `WorkspaceEditorPane` tests to assert Markdown files render preview by default on initial activation.
- [x] 2.2 Add test coverage that re-activating an already-open Markdown file resets it to preview instead of remembering the last manual view.
