## 1. Backend Governance Metadata

- [x] 1.1 Extend managed skill backend types, normalization, and API payloads to carry optional `starterSummary` governance metadata.
- [x] 1.2 Update managed skill import/update/list flows so `starterSummary` is stored separately from `displayDescription` and returned to governed product surfaces.
- [x] 1.3 Add or update backend tests covering `starterSummary` persistence, empty-value fallback behavior, and unchanged canonical skill package handling.

## 2. Skill Management UI

- [x] 2.1 Extend admin skill management frontend types and API calls to read and save `starterSummary`.
- [x] 2.2 Reorganize the skill detail form into dedicated starter governance controls, including `快速开始摘要` helper text and validation messaging.
- [x] 2.3 Add a starter-card preview panel in the management UI that reflects current governed name, summary fallback, and starter action layout.
- [x] 2.4 Update frontend tests for the management UI to cover starter summary editing, preview fallback, and save payload behavior.

## 3. Workbench Starter Presentation

- [x] 3.1 Update workbench starter view models to expose governed starter summary data with the defined fallback chain.
- [x] 3.2 Refactor empty-conversation starter detail rendering so summary copy and starter action use separate layout containers and long Chinese copy cannot clip the action control.
- [x] 3.3 Verify starter execution still sends the governed `starterPrompt` and clears selected starter state after activation.
- [x] 3.4 Update conversation/workbench tests to cover governed summary rendering, fallback behavior, and stable starter action visibility.

## 4. Verification

- [x] 4.1 Run the relevant workspace test suites for managed skill governance and workbench starter UI behavior.
- [x] 4.2 Smoke-check the admin skill management page and empty conversation starter surface to confirm the previewed starter summary matches the rendered workbench card.
