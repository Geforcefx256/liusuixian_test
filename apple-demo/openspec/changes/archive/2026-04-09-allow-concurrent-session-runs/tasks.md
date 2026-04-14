## 1. Backend Session-Scoped Runtime Tracking

- [x] 1.1 Refactor `RunCoordinator` and related `AgentService` run-admission logic to track active runs and pending-question ownership by `sessionId` while keeping workspace resolution scoped to `user + agent`
- [x] 1.2 Update runtime bootstrap and session-list metadata so the backend returns session-local activity state and no longer reports another session as a workspace-global owner
- [x] 1.3 Update session delete and bulk-clear history routes/store logic so active sessions are rejected or skipped individually, and bulk-clear responses report skipped active session ids

## 2. Frontend Session-Keyed Run State

- [x] 2.1 Replace the workbench store's single `activeRun` / `isRunning` / `workspaceOccupancy` model with session-keyed run state and selectors for current-session send/stop availability
- [x] 2.2 Route run lifecycle, streaming, error, stop-pending, and pending-question updates to the owning session so switching tabs does not leak status across sessions
- [x] 2.3 Update blank-draft and first-send flow so a new conversation or another idle session can still create and start a run while a different session is active

## 3. History Management And Shared-Workspace UI

- [x] 3.1 Update the history rail to show per-session active indicators and keep delete available for idle sessions even when another session in the shared workspace is active
- [x] 3.2 Update bulk-clear availability, confirmation copy, and post-action reconciliation so the current session and other active sessions are preserved while idle historical sessions are removed
- [x] 3.3 Update composer and hover/focus help so only current-session `running` / `awaiting-question` states block normal send, while shared-workspace labeling remains unchanged

## 4. Verification

- [x] 4.1 Add backend tests for concurrent session run admission, session-local pending-question blocking, active-session delete rejection, and bulk-clear skipping active sessions
- [x] 4.2 Add frontend store/component tests for switching sessions while runs overlap, returning to the active session stop control, deleting an idle session during another session's run, and preserving active sessions during bulk clear
- [x] 4.3 Run the targeted type-check and automated test commands for `apps/agent-backend` and `apps/web`
