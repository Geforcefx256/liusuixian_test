## 1. Store refresh flow

- [x] 1.1 Add a workbench-store helper that reloads currently open workspace files whose editor state exists and is not dirty.
- [x] 1.2 Invoke the helper from the successful post-run reconciliation path after `reloadSessionState()` completes, while preserving active file and open-tab state.
- [x] 1.3 Ensure automatic refresh surfaces request failures through existing error handling and never overwrites dirty editor content.

## 2. Regression coverage

- [x] 2.1 Add a store test proving that a successful run refreshes stale content for an already-open non-dirty workspace file.
- [x] 2.2 Add a store test proving that an already-open dirty workspace file keeps its local unsaved content after post-run reconciliation.
- [x] 2.3 Run the targeted workbench store test suite and confirm the new coverage passes.
