## 1. Session Hydration Fix

- [x] 1.1 Update `apps/web/src/stores/workbenchStore.ts` to preserve a running session's local transient assistant placeholder when session history is rehydrated before the persisted assistant message exists.
- [x] 1.2 Add reconciliation logic so the preserved transient assistant placeholder is removed once authoritative persisted assistant history for the same turn becomes available.
- [x] 1.3 Keep the existing terminal-state behavior intact for completed, cancelled, failed, and awaiting-question runs while applying the new hydration merge logic.

## 2. Regression Coverage

- [x] 2.1 Add a store test covering rapid `sessionA -> sessionB -> sessionA` switching where `sessionA` is still running and the reloaded history temporarily contains only the user message.
- [x] 2.2 Add a store test verifying that later stream events continue updating the preserved assistant placeholder after the session is reopened.
- [x] 2.3 Add a store test verifying that once the persisted assistant message appears in reloaded history, the transient placeholder is removed and no duplicate assistant bubble remains.

## 3. Verification

- [x] 3.1 Run the targeted frontend store test command for `apps/web/src/stores/workbenchStore.test.ts` and confirm the new session-switching regressions pass.
