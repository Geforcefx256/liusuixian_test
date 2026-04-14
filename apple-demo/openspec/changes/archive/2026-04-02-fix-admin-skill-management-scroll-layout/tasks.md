## 1. Admin Skill Management Layout

- [x] 1.1 Adjust `AdminSkillManagement` height propagation so the admin layout, detail pane, and detail body can shrink correctly inside the viewport-constrained workbench shell
- [x] 1.2 Add pane-owned scrolling for the governance detail content while preserving the existing independent scrolling behavior of the managed skill list
- [x] 1.3 Rework the `Starter 摘要与预览` control layout so the toggle, selectors, priority input, summary field, and preview remain fully visible at common desktop and narrow widths

## 2. Verification

- [x] 2.1 Update frontend tests to assert the admin skill management detail area exposes its own scrollable container and retains the expected starter-governance structure
- [x] 2.2 Add or update responsive style assertions that guard against the starter governance section overflowing the visible width at narrower breakpoints
