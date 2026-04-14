## 1. Backend Upload Contract

- [x] 1.1 Update `apps/agent-backend` so the authenticated workbench composer upload flow accepts only `.txt`, `.md`, and `.csv` files for this surface while preserving existing reusable workspace-entry behavior.
- [x] 1.2 Return clear validation failures for unsupported composer-upload extensions and confirm accepted `.txt` files still follow the current plain-text / MML-aware file-open path.
- [x] 1.3 Add or update backend tests covering accepted composer uploads, rejected unsupported uploads, and resulting workspace-entry persistence.

## 2. Frontend Composer Entry Refinement

- [x] 2.1 Update the conversation composer in `apps/web` so its primary left-side file action is labeled `上传文件` and no longer exposes blank-file creation actions from the composer surface.
- [x] 2.2 Replace the always-visible supported-format copy with a compact adjacent help affordance that lists `TXT / MD / CSV`, opens upward, and supports hover, focus, and click interactions.
- [x] 2.3 Rework the composer action-row layout so the upload-entry cluster and send action remain width-stable on supported laptop-width workbench layouts.

## 3. Workspace Boundary And Verification

- [x] 3.1 Keep blank-file creation entry points in the right-side workspace area so the composer refinement does not remove governed file-creation access from the workbench.
- [x] 3.2 Refresh related user-facing composer copy so stale `新增文件` framing and long inline format descriptions are removed.
- [x] 3.3 Add or update frontend tests covering upload-button labeling, upward help behavior, supported-format copy, and constrained-width send-button stability.
