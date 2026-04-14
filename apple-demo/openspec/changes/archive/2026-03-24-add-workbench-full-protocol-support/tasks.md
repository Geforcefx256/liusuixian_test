## 1. Protocol Runtime Foundations

- [x] 1.1 Expand `apps/web` protocol and message types so protocol state can represent form snapshots, list selection, table state, and persisted message overrides.
- [x] 1.2 Add shared protocol runtime helpers for building UI-state snapshots, action runtime context, and placeholder resolution from live protocol state.
- [x] 1.3 Update session-history mapping and reload logic so protocol messages prefer persisted message overrides when protocol state contains a converged message snapshot.

## 2. Protocol Rendering Expansion

- [x] 2.1 Replace the current planner-only protocol card logic with rendering support for `form`, `table`, `button-group`, and richer text-style handling while preserving existing `text` and `list` behavior.
- [x] 2.2 Add list selection handling and persisted UI-state updates for selectable protocol lists.
- [x] 2.3 Add editable and read-only table rendering paths that preserve protocol-local table state.
- [x] 2.4 Keep mixed-message fallback behavior safe so unsupported components still surface explicit notices without suppressing supported protocol content.

## 3. Protocol Action Runtime And Question Loop

- [x] 3.1 Replace planner-only protocol action branching in the workbench store with a general protocol action dispatcher for `submit`, `cancel`, `tool`, `redirect`, and `delegate`.
- [x] 3.2 Implement `question_response` execution using resolved form state, required-value validation, and the existing session run pipeline.
- [x] 3.3 Add post-submit message convergence for question and plan actions, including persisted removal or disabling of stale actions after success.
- [x] 3.4 Mask or rewrite technical question-response payload echoes so the conversation shows user-meaningful feedback instead of raw JSON bubbles.

## 4. Workbook-Coupled Protocol Compatibility

- [x] 4.1 Inventory workbook-coupled protocol tool actions currently emitted by migrated runtime flows and map each to either supported execution or governed compatibility feedback.
- [x] 4.2 Implement governed execution or explicit compatibility notices for `gateway_tools_invoke` and other workbook-coupled protocol tool actions in the current workbench shell.
- [x] 4.3 Implement governed execution or explicit compatibility notices for row-modification protocol actions such as `modify_mml_rows`, including any required pending-state handling.

## 5. Validation

- [x] 5.1 Add frontend tests for `form`, `table`, `button-group`, selectable lists, text styles, and mixed supported/unsupported protocol messages.
- [x] 5.2 Add frontend tests for placeholder resolution, `question_response` validation, successful question submission, redirect/cancel handling, and reload recovery from persisted message overrides.
- [x] 5.3 Add frontend or backend contract tests where needed for richer protocol-state persistence and workbook-coupled protocol action payload stability.
