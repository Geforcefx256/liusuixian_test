## 1. Starter data and interaction contract

- [x] 1.1 Review the empty-conversation starter flow in `apps/web/src/stores/workbenchStore.ts` and `apps/web/src/components/workbench/ConversationPane.vue` to confirm the governed summary and full-description sources used by starter cards.
- [x] 1.2 Update the starter-skill view contract so the expanded starter row can render the governed title and starter summary, with the hover help surface reusing the governed title plus starter summary without changing the existing `开始使用` execution path.
- [x] 1.3 Keep starter-card selection behavior unchanged so only one expanded skill remains active across starter cards and search results while the hover help card remains a read-only supplement.

## 2. Desktop hover help card implementation

- [x] 2.1 Add a dedicated `i` information trigger to expanded starter-skill rows in `apps/web/src/components/workbench/ConversationPane.vue`, limited to the desktop empty-conversation starter surface.
- [x] 2.2 Render a lightweight hover help card anchored to the expanded starter row that shows the governed skill name and starter summary without adding duplicate action buttons.
- [x] 2.3 Implement the fixed placement rules for the three starter columns and apply the required local positioning, overflow, and stacking styles so the help card is not clipped by the starter card shell.
- [x] 2.4 Enforce the hover help card text bounds in styles: single-line title, description capped at 6 visible lines, and no internal scrolling.

## 3. Verification

- [x] 3.1 Add or update component tests for `ConversationPane.vue` to cover the `i` trigger, hover-help rendering conditions, fixed placement classes or states, and the absence of duplicate `开始使用` actions in the hover card.
- [x] 3.2 Add or update any affected store/component tests to verify the starter summary remains inline and is also reused by the hover help surface without affecting search-panel state.
- [x] 3.3 Run the relevant frontend test suite or targeted Vitest coverage for the workbench starter experience and confirm the new behavior does not mutate search-panel state.
