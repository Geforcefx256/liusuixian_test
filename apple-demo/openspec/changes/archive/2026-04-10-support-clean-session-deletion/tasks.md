## 1. Backend deletion lifecycle

- [x] 1.1 Add session tombstone schema support in `apps/agent-backend/src/agent/sessionStoreUtils.ts` and expose store helpers for marking and checking deleted session ids.
- [x] 1.2 Refactor session deletion in `apps/agent-backend/src/agent/sessionStore.ts` and `apps/agent-backend/src/agent/service/AgentService.ts` to tombstone first, purge session-owned data, and release active runtime occupancy instead of rejecting active-session deletes.
- [x] 1.3 Update backend runtime coordination in `apps/agent-backend/src/agent/service/RunCoordinator.ts`, delete route handling in `apps/agent-backend/src/routes/agent.ts`, and related runtime error handling so deleted active sessions cancel or release cleanly and stale writes cannot recreate the session.
- [x] 1.4 Guard all session-scoped backend write paths in `apps/agent-backend/src/agent/sessionStore.ts` so message, summary, plan, interaction, protocol-state, and session-metadata writes fail explicitly for deleted session ids.

## 2. Workbench deletion behavior

- [x] 2.1 Update delete affordances in `apps/web/src/components/workbench/SessionRail.vue` and `apps/web/src/api/agentApi.ts` so active sessions can be confirmed for deletion through the existing API.
- [x] 2.2 Add deleted-session tracking in `apps/web/src/stores/workbenchStore.ts` so confirmed deletes remove the session immediately, return the active view to a blank shell when needed, and preserve the shared workspace sidebar.
- [x] 2.3 Apply deleted-session guards across stream, hydrate, reload, and session-list synchronization paths in `apps/web/src/stores/workbenchStore.ts` so stale callbacks cannot recreate a deleted session locally.
- [x] 2.4 Add failure rollback handling in `apps/web/src/stores/workbenchStore.ts` so optimistic deletion restores local state correctly if the backend delete request fails.

## 3. Regression coverage

- [x] 3.1 Update `apps/agent-backend/tests/agent.auth.routes.test.ts` to verify running and awaiting-question sessions can be deleted and no longer return occupancy conflicts.
- [x] 3.2 Extend `apps/agent-backend/src/agent/sessionStore.test.ts` to cover tombstoned session ids, rejected stale writes, and prevention of session resurrection after delete.
- [x] 3.3 Update `apps/web/src/stores/workbenchStore.test.ts` to verify active-session deletion immediately clears the UI and ignores late stream or reload callbacks for deleted sessions.
- [x] 3.4 Run targeted backend and frontend test suites that cover the modified delete flows and store/runtime regressions.
