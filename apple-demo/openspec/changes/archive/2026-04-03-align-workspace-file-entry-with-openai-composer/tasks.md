## 1. Composer Upload Entry

- [x] 1.1 Replace the text-based upload buttons in `HomeStage` and `ConversationPane` with a compact `+` attachment trigger that opens the governed file picker directly.
- [x] 1.2 Add composer-surface drag-and-drop upload handling for supported files, including multi-file drop support and composer-only drag highlight states.
- [x] 1.3 Keep upload validation explicit for picker and drag flows so unsupported file types fail visibly while `TXT / MD / CSV` remain the only accepted formats.

## 2. Workspace Sidebar Simplification

- [x] 2.1 Remove the workspace sidebar `新增` entry UI, related empty-state wording, and any frontend event wiring that assumes a workspace-scoped upload or blank-file creation action.
- [x] 2.2 Rename user-facing workspace group labels from `input` / `output` to `参考资料` / `生成结果` while preserving existing file open, read-only, save, download, delete, and rename behaviors.
- [x] 2.3 Delete the frontend blank-file creation flow, including create-file component contracts, API calls, store actions, and focused tests.

## 3. Runtime Contract Cleanup

- [x] 3.1 Remove the runtime blank-file creation route and supporting empty-file blueprint helpers that are no longer part of the product model.
- [x] 3.2 Keep runtime workspace metadata and upload responses aligned with the new sidebar grouping labels and existing upload restrictions.
- [x] 3.3 Verify the remaining upload/open/save/download/delete/rename contracts still behave correctly after the blank-file creation path is removed.

## 4. Verification

- [x] 4.1 Update frontend tests to cover the `+` attachment trigger, composer-only drag-and-drop upload, multi-file selection, and the absence of workspace create-file controls.
- [x] 4.2 Update backend tests to cover the removed blank-file creation path, retained upload allowlist enforcement, and the new workspace group labeling.
- [x] 4.3 Run the relevant automated checks for `apps/web` and `apps/agent-backend`, and confirm the OpenSpec change is apply-ready.
