## 1. Composer Action Update

- [x] 1.1 Refactor `ConversationPane.vue` to replace the parallel send/stop buttons with a single primary action slot that switches across idle, running, and stop-pending states.
- [x] 1.2 Replace text-first send/stop controls with icon-first button content, preserve danger semantics for stop, and remove the persistent stop side-effect note.
- [x] 1.3 Add or update accessible names, decorative icon handling, and pending-state affordances for the icon-only composer action.

## 2. Verification

- [x] 2.1 Update `ConversationPane.test.ts` to cover the single action slot, icon-state switching, disabled stop-pending behavior, and removal of the stop note.
- [x] 2.2 Run the relevant frontend tests for `ConversationPane` and confirm the new composer action behavior matches the spec.
