## 1. Backend Workspace File Creation

- [x] 1.1 Add an explicit workspace file creation API in `apps/agent-backend` for blank TXT, MD, and MML files within the current `user + agent` workspace.
- [x] 1.2 Ensure newly created files are returned through the existing workspace listing, open, and save flows with the same identity model as uploaded files.
- [x] 1.3 Add or update backend tests covering allowed create types, default file initialization, and invalid create requests.

## 2. Frontend Workspace Shell Refinement

- [x] 2.1 Update the right workspace sidebar to keep `工作空间` as the peer tab to `模板` while removing redundant headings such as `工作区文件` and `小曼智能体工作区`.
- [x] 2.2 Replace the current upload-only workspace entry affordance with a unified `新增` menu containing `上传文件`, `新建 TXT`, `新建 MD`, and `新建 MML`.
- [x] 2.3 Remove the `关闭工作区` action from the workspace editor shell and make closing the last open file return the shell to the conversation-first base state.
- [x] 2.4 Update empty states and related workspace entry copy so the UI no longer implies upload-only behavior where create-file behavior is available.

## 3. Pane Resizing And Validation

- [x] 3.1 Add desktop drag-resize behavior for the history rail, conversation pane, workspace editor, and workspace sidebar with governed minimum widths.
- [x] 3.2 Preserve low-resolution fallback behavior so the sidebar yields or collapses before the editor loses its stable primary editing width.
- [x] 3.3 Add or update frontend tests for the `新增` menu flows, workspace shell exit behavior, and pane resizing state.
- [x] 3.4 Verify the final shell on low-resolution laptop widths to confirm the `工作空间` / `模板` tabs remain readable without wrapping and the editor remains usable.
