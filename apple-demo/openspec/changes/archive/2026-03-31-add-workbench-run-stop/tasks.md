## 1. Run cancel contract

- [x] 1.1 Add frontend API support for run cancellation, including a typed cancel response that distinguishes request failure from `cancelled: false` no-op acknowledgement.
- [x] 1.2 Capture and clear active run identity in the workbench store from stream lifecycle events so stop targets only the current run in the selected session.
- [x] 1.3 Add backend coverage for active-run cancel and no-op cancel semantics without broadening cancellation to the whole session.

## 2. Conversation stop UX

- [x] 2.1 Add a stop control to the active conversation surface and gate it on active-run availability rather than completed history or awaiting-interaction state.
- [x] 2.2 Implement stop-pending UI state that preserves partial streamed output while cancellation is in flight and surfaces explicit stop-request failures.
- [x] 2.3 Converge terminal cancelled runs to a transient `已停止` presentation instead of routing them through the generic execution-failed branch.

## 3. Authoritative convergence rules

- [x] 3.1 Reload the active session after terminal cancellation and decide whether to keep a transient stopped placeholder or replace it with refreshed authoritative session state.
- [x] 3.2 Preserve authoritative pending-interaction and saved-plan UI when those states beat cancellation in a persistence race.
- [x] 3.3 Keep cancellation semantics explicit that already-persisted session state and prior tool side effects are not rolled back.

## 4. Verification

- [x] 4.1 Add workbench store tests for stop success, cancel transport failure, and `cancelled: false` no-op handling.
- [x] 4.2 Add component tests for stop control visibility and stop-pending button state in the conversation pane.
- [x] 4.3 Add regression coverage for cancellation races with pending question interaction and saved plan state so the UI renders authoritative state instead of a synthetic stopped result.
