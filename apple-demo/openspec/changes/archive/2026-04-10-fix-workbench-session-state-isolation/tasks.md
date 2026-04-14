## 1. Session-Scoped Conversation UI State

- [x] 1.1 Refactor `apps/web/src/stores/workbenchStore.ts` so conversation status and plan summary are stored per session instead of in a single global conversation-status field
- [x] 1.2 Update the workbench context-pane bindings to project the active session's scoped conversation status while keeping non-conversation workspace actions on a separate global status path

## 2. Deterministic Session Hydration

- [x] 2.1 Add per-session hydration generation tracking to `selectSession()` and `reloadSessionState()` so stale responses for the same session are discarded
- [x] 2.2 Ensure session reset and deletion paths clear any scoped hydration metadata together with the corresponding local session state

## 3. Run Ownership And Cleanup

- [x] 3.1 Refactor `runConversationInput()` to capture immutable run ownership before async work and use that ownership for optimistic message updates, failures, cancellations, and terminal cleanup
- [x] 3.2 Remove exception and convergence paths that clear run state based on the current `activeSessionId`, and reconcile cleanup against the run-owning session instead

## 4. Verification

- [x] 4.1 Add store tests covering background-session status isolation and `A -> B -> A` stale hydration races
- [x] 4.2 Add store tests covering run failure or cancellation after switching away from the owning session
- [x] 4.3 Run targeted frontend verification for the updated workbench store and context-pane behavior
