## 1. Workspace File Contract

- [x] 1.1 Rework scoped workspace storage to preserve uploaded original filenames under `uploads/` and require explicit overwrite intent for same-path replacement.
- [x] 1.2 Extend workspace file metadata and open payloads with workspace-relative path, source, and writability so the frontend can distinguish read-only uploads from writable files.
- [x] 1.3 Reject save attempts for files sourced from `uploads/` while preserving normal in-place saves for writable workspace files.

## 2. Scoped File Tools And Model Context

- [x] 2.1 Re-root `find_files`, `read_file`, and `list_directory` to the current `user + agent` scoped workspace and reject path escapes outside that root.
- [x] 2.2 Replace model-facing `fileKey` / `@file:<fileKey>` file hints with path-first active-file context and remove the old opaque handle instructions from runtime prompts.
- [x] 2.3 Update follow-up run assembly so the active workspace file path is the only default file hint and broader workspace files remain discoverable through tools rather than auto-injected file lists.

## 3. Sandboxed Bash Execution

- [x] 3.1 Introduce a `SandboxExecutor` abstraction and runtime configuration for sandbox backend selection plus CPU / memory / timeout limits.
- [x] 3.2 Implement sandboxed `bash` execution with read-only runtime mounts, read-only `uploads/`, writable `outputs/` and `temp/`, and explicit failure when commands touch disallowed paths.
- [x] 3.3 Enforce host isolation and disabled network access for sandboxed `bash`, and remove the old unsandboxed host `spawn` execution path without adding a silent fallback.

## 4. Skill And Script Migration

- [x] 4.1 Rewrite governed skills that currently depend on `fileKey` or `@file:<fileKey>` so they use workspace-relative paths and the new `bash` contract.
- [x] 4.2 Update governed scripts to accept explicit path-based inputs and workspace output directories instead of deriving output identity from input filenames.
- [x] 4.3 Refresh runtime asset and reference loading so skill scripts can read governed runtime references while still writing only into the current user workspace.

## 5. Workbench Upload And Editor UX

- [x] 5.1 Add upload collision detection and a user confirmation flow before retrying same-name upload replacement.
- [x] 5.2 Render uploaded workspace files as read-only review surfaces in the editor and disable save actions for those files.
- [x] 5.3 Update continue-processing and related run flows to submit the active workspace file path as primary context while keeping outputs and uploads discoverable through the workspace UI.

## 6. Verification

- [x] 6.1 Add backend tests for original-name uploads, overwrite confirmation, read-only upload saves, scoped file-tool roots, and path-based file hints.
- [x] 6.2 Add sandbox execution tests covering runtime/read-only mount behavior, writable output paths, network denial, and bounded resource failures.
- [x] 6.3 Add frontend tests for upload overwrite confirmation, read-only upload editor state, and path-first follow-up context submission.
