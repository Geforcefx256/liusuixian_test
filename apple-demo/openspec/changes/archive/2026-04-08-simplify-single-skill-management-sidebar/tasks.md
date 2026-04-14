## 1. Change Artifacts

- [x] 1.1 Update the change spec so multi-skill datasets no longer keep the legacy governance list branch
- [x] 1.2 Update the design to describe a summary-card navigation pattern for multi-skill management
- [x] 1.3 Clarify in the design that selection remains available in multi-skill mode even after removing search, filter, and stats blocks

## 2. Sidebar Layout

- [x] 2.1 Remove the single-skill-only layout split in `AdminSkillManagement.vue`
- [x] 2.2 Render the left pane as a summary-style rail for both single-skill and multi-skill datasets
- [x] 2.3 Preserve skill selection behavior for multi-skill datasets with clickable summary cards
- [x] 2.4 Remove the governance-list heading, search field, lifecycle filter, and draft/published counters from the left pane

## 3. Summary Card Content Rules

- [x] 3.1 Render each summary card title from governed `displayName`
- [x] 3.2 Show `待填写用户可见名称` when `displayName` is empty instead of falling back to canonicalName or skillId
- [x] 3.3 Render lifecycle and Starter status on summary cards
- [x] 3.4 Render the localized intent-group label only when Starter is enabled
- [x] 3.5 Exclude canonicalName, skillId, source agent, and bound-agent count from the left summary cards

## 4. Verification

- [x] 4.1 Update `AdminSkillManagement.test.ts` to cover single-skill and multi-skill summary-card rendering
- [x] 4.2 Add test coverage for multi-skill selection behavior after the list controls are removed
- [x] 4.3 Add test coverage for the empty display-name placeholder and Starter-gated intent-group rendering
- [x] 4.4 Run the relevant frontend test command for the updated skill-management component
