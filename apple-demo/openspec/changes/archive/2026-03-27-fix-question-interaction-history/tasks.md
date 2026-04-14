## 1. Backend canonical history and continuation replay

- [x] 1.1 Append a normalized `user` session message when a pending question interaction is answered or rejected, and keep the interaction record resolved in the same session.
- [x] 1.2 Remove build-phase and planner-phase temporary interaction-answer injection so continuation replay uses persisted session history as the only authoritative source.
- [x] 1.3 Exclude awaiting-interaction waiting placeholders and awaiting-interaction tool snapshots from future model replay while preserving the resolved interaction user message.
- [x] 1.4 Reject ordinary `/agent/run` input when the session still has a pending question interaction, while preserving the dedicated reply / reject -> continuation path.

## 2. Workbench pending-question enforcement

- [x] 2.1 Disable the normal composer, send action, and upload entry points whenever the active session has a pending question interaction.
- [x] 2.2 Keep the pending question card reply / reject actions working with the dedicated continuation run flow after the interaction is resolved.
- [x] 2.3 Update session reload and blocked-run handling so the frontend converges cleanly when the backend rejects ordinary input for a pending session.

## 3. Verification

- [x] 3.1 Add backend tests for answered and rejected question interactions becoming canonical `user` session messages before continuation.
- [x] 3.2 Add backend tests that cover shared build / planner replay semantics, waiting-artifact exclusion from later model input, and explicit rejection of ordinary `/agent/run` input while pending.
- [x] 3.3 Add frontend tests for pending-composer disabling, reply / reject continuation behavior, and resolved interaction recovery from normal session history.
