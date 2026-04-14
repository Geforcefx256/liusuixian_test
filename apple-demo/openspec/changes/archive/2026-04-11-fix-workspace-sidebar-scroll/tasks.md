## 1. Sidebar layout repair

- [x] 1.1 Update `WorkbenchShell.vue` sidebar-slot layout styles so the right-side shell can shrink correctly and host internal scrolling.
- [x] 1.2 Update `WorkspaceSidebar.vue` shell, panels, panel, and group-tree styles so the workspace panel becomes the single vertical scroll container for long file lists.
- [x] 1.3 Verify the existing workspace-expanded and constrained-width collapse/re-expand behavior still works after the sidebar scroll-container change.

## 2. Regression coverage

- [x] 2.1 Update workspace sidebar component tests to assert that the sidebar panel owns vertical scrolling and nested tree containers no longer do.
- [x] 2.2 Add long-list regression coverage for the workspace file tree so later file entries remain reachable through sidebar-local scrolling.

## 3. Validation

- [x] 3.1 Run the targeted workbench component tests covering `WorkspaceSidebar` and `WorkbenchShell`.
- [x] 3.2 Run `pnpm run type-check` and confirm the sidebar scroll fix does not introduce frontend type regressions.
