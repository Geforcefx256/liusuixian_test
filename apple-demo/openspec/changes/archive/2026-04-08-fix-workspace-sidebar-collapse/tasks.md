## 1. Sidebar Visibility Behavior

- [x] 1.1 Update `apps/web/src/components/workbench/WorkbenchShell.vue` so the effective workspace sidebar collapsed state truly removes the sidebar from the active shell layout while preserving the current open file and re-expand affordance.
- [x] 1.2 Remove or replace the unused collapsed-only visual contract in `apps/web/src/components/workbench/WorkspaceSidebar.vue` so sidebar visibility is no longer implied by a dead CSS class.
- [x] 1.3 Ensure manual collapse, auto-collapse, and constrained-width manual re-open continue to share one predictable precedence model without closing the active workspace file.

## 2. Sidebar Chrome Responsiveness

- [x] 2.1 Refine the workspace sidebar header and compact styles so `工作空间` / `模板` and the explicit collapse control remain visually grouped and operable when the sidebar is reopened under constrained width.
- [x] 2.2 Keep the sidebar’s existing file-tree, template tab, and local interaction affordances intact while closing any transient local UI state that should not survive a hidden sidebar surface.

## 3. Verification

- [x] 3.1 Update `apps/web/src/components/workbench/WorkbenchShell.test.ts` to cover user-initiated collapse, explicit re-expand, constrained-width auto-collapse, and active-file continuity.
- [x] 3.2 Add or update sidebar-focused tests to verify the compact header contract and confirm the implementation no longer relies on an unused collapsed CSS hook.
- [x] 3.3 Run the relevant frontend test suites for workbench shell and workspace sidebar behavior.
