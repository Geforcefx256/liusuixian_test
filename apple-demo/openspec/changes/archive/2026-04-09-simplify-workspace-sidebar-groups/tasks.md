## 1. Sidebar Presentation

- [x] 1.1 Remove the dedicated shared-workspace title row and hover copy from `apps/web/src/components/workbench/WorkspaceSidebar.vue`.
- [x] 1.2 Update the workspace group headers to render folder icons and user-facing labels `upload` and `project`.
- [x] 1.3 Keep empty `upload` and `project` groups visually clean by hiding zero counts and removing per-group empty-copy rows.

## 2. Creation Entry Alignment

- [x] 2.1 Change the top project creation trigger from `NEW` to `+` in `WorkspaceSidebar.vue` while preserving the existing create menu actions.
- [x] 2.2 Reuse the folder-level `+` trigger styling for the top project creation trigger without changing the underlying `working` create behavior.

## 3. Data Mapping And Tests

- [x] 3.1 Update workspace payload label mapping in `apps/web/src/stores/workbenchStore.ts` so the UI receives `upload` and `project` labels while keeping internal `groupId` values unchanged.
- [x] 3.2 Update `apps/web/src/components/workbench/WorkspaceSidebar.test.ts` to assert the new labels, clean empty-state behavior, and `+` creation trigger behavior.
- [x] 3.3 Run the relevant frontend test coverage for the workspace sidebar and confirm the updated behavior matches the new spec.
