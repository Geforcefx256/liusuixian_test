## Why

The workbench can start a streaming agent run, but it cannot explicitly stop the current run from the conversation surface. That leaves users trapped in long or obviously wrong executions and forces them to wait for backend completion even when the active run should be abandoned.

This needs to change now because the runtime already exposes run-level cancellation semantics, while the frontend still lacks a product contract for when stop is available, how cancellation should converge in the UI, and how durable tool side effects should affect the final presentation.

## What Changes

- Add a first-class workbench stop control that targets only the current active run in the selected session.
- Define stop as a run-level cancellation request rather than a session reset or history rewrite.
- Converge the active assistant placeholder to a transient `已停止` outcome only when cancellation wins before any durable session-side effect becomes the authoritative terminal state.
- Preserve authoritative runtime outcomes such as awaiting-interaction or saved-plan state when cancellation races with durable side effects instead of forcing every stopped run into the same visual result.
- Expose clear frontend behavior for stop-in-progress, cancellation failures, and `cancelled: false` responses when the run has already ended.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-backend-runtime`: extend the browser-facing run contract so active runs can be cancelled intentionally and so cancellation remains distinguishable from durable awaiting-interaction or persisted tool side effects.
- `agent-web-workbench`: add stop affordance, stop-pending UI state, and current-turn result convergence rules for cancelled runs without persisting a synthetic stopped history message.

## Impact

- Frontend conversation store, streaming run lifecycle handling, and composer/conversation controls in `app/web`.
- Backend run API contract and cancellation/result semantics in `app/agent-backend`.
- Tests covering run cancellation, status-header convergence, and side-effect-aware stop races.
