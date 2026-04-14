## Why

The workbench already reloads workspace metadata after a successful run, but it keeps reusing stale in-memory editor content for files that were opened before the tool mutated them. Users can see the updated file in the workspace tree while the editor still shows old content until they reload the entire page, which breaks trust in the workspace editing flow.

## What Changes

- Update the workbench workspace-refresh flow so a successful run actively refreshes the content of already-open workspace files when those files are not locally dirty.
- Preserve local unsaved edits by skipping automatic content refresh for files whose editor state is dirty.
- Add regression coverage for the stale-content path triggered by tool-driven workspace mutations and for the dirty-file protection path.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: change workspace editor behavior so successful tool runs refresh open, non-dirty file content without requiring a full page reload.

## Impact

- Affected frontend store logic in `apps/web/src/stores/workbenchStore.ts`.
- Affected frontend tests around workspace file loading and post-run reconciliation in `apps/web/src/stores/workbenchStore.test.ts`.
- No top-level directory changes.
- No third-party dependency changes.
