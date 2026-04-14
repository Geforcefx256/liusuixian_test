## Why

The current agent workbench allows users to switch or create sessions while a run is still active, but the runtime and UI do not enforce a consistent shared-workspace execution model. This causes cross-session confusion around run ownership, disabled actions, stream placement, and destructive history actions while the same `user + agent` workspace is still active.

## What Changes

- Enforce a single active run per shared `user + agent` workspace instead of allowing parallel session runs within the same workspace scope.
- Keep session conversations separate while preserving a shared workspace for files, uploads, generated outputs, and workspace editor content.
- Prevent secondary sessions from starting new runs while another session in the same workspace is active, while still allowing draft editing and new draft-session creation.
- Keep active runs alive across page refresh, session switching, and transient client disconnects; only explicit user stop actions cancel a run.
- Disable session deletion and bulk history clearing for the active workspace while any run is active or awaiting a required question response.
- Surface shared-workspace occupancy and locked actions through lightweight hover/focus help instead of intrusive blocking UI.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: Change workbench session-switching, composer, history-management, and shared-workspace UI requirements to reflect single-workspace active-run governance.
- `agent-backend-runtime`: Change run lifecycle and history/workspace runtime guarantees so the backend enforces one active run per `user + agent` workspace and does not cancel runs merely because the client stream disconnects.

## Impact

- Affected frontend code in `apps/web`, especially workbench store session/run state handling, session rail actions, composer gating, and shared-workspace affordances.
- Affected backend code in `apps/agent-backend`, especially run coordination, run cancellation semantics, active-run lookup surfaces, and session/history deletion guards.
- Affected API behavior for run submission, run status recovery after reconnect, and destructive history actions during active workspace execution.
- No top-level directory restructuring or third-party dependency changes are required for this change.
