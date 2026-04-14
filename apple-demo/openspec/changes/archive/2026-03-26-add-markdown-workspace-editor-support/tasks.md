## 1. Backend Workspace Contract

- [x] 1.1 Extend the agent-backend upload allowlist to accept `.md` files for workspace uploads.
- [x] 1.2 Update workspace file mode detection and API types so `.md` files open and save as `markdown` mode instead of generic `text`.
- [x] 1.3 Preserve Markdown artifact references through the existing structured result payload without changing the current artifact_ref shape.

## 2. Frontend Markdown Workspace Experience

- [x] 2.1 Extend shared frontend workspace file types and store state to recognize `markdown` mode.
- [x] 2.2 Update the workspace editor shell so Markdown files use edit/preview view switching and never expose the MML parsing entry.
- [x] 2.3 Bind Markdown edit view to Monaco with a Markdown language mode and add a sanitized Markdown preview rendering path.

## 3. Artifact Presentation And Verification

- [x] 3.1 Verify artifact result cards continue to open Markdown references through the existing `打开文件` entry point without introducing a Markdown-specific label split.
- [x] 3.2 Refresh visible upload hints or related user-facing copy so Markdown appears in the supported workbench file set.
- [x] 3.3 Add or update backend and frontend tests covering Markdown upload, open/save mode detection, editor view behavior, preview switching, and artifact open behavior.
