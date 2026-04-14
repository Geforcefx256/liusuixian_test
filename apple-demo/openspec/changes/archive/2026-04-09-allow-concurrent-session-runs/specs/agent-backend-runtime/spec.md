## MODIFIED Requirements

### Requirement: Runtime session metadata SHALL support preview-rich workbench history rails
The runtime SHALL expose session-list metadata that is sufficient for the frontend to render a preview-rich history rail, identify each session's local activity state, perform explicit session deletion flows, and clear deletable historical sessions in bulk for the active agent while preserving the currently excluded session and any active sessions.

#### Scenario: Session list includes preview-ready metadata and local activity state
- **WHEN** a client requests the session list for an agent
- **THEN** each returned session item MUST include a stable one-line preview string suitable for history-rail display
- **AND** each returned session item MUST continue to identify the session, title, and update timing needed for rail ordering and selection
- **AND** each returned session item MUST include enough session-local activity metadata for the frontend to distinguish idle, running, and unresolved pending-question sessions

#### Scenario: Idle session deletion removes persisted session state
- **WHEN** a client issues a confirmed delete for a session that does not currently have an active run or an unresolved pending question
- **THEN** the runtime MUST delete the persisted session record for that user and agent
- **AND** the runtime MUST remove persisted messages and related derived session state that belongs exclusively to that deleted session

#### Scenario: Active session deletion is rejected
- **WHEN** a client issues a confirmed delete for a session that currently has an active run or an unresolved pending question
- **THEN** the runtime MUST reject that deletion with an explicit conflict response
- **AND** the runtime MUST NOT delete persisted session state for that request

#### Scenario: Bulk history clear removes every deletable historical session for the active agent
- **WHEN** a client issues a confirmed bulk-clear request for an active agent with an excluded current session id
- **THEN** the runtime MUST delete every persisted idle session for that authenticated user and active agent except the excluded session
- **AND** the runtime MUST preserve any session that currently has an active run or an unresolved pending question
- **AND** the runtime MUST remove persisted messages, summaries, plans, interactions, and session metadata that belong exclusively to each deleted session

#### Scenario: Bulk history clear can preserve no current session when none is excluded
- **WHEN** a client issues a confirmed bulk-clear request for an active agent without providing an excluded session id
- **THEN** the runtime MUST treat every persisted idle session for that authenticated user and active agent as a deletable target
- **AND** the runtime MUST preserve any session that currently has an active run or an unresolved pending question
- **AND** the runtime MUST return a successful response when those idle targets are removed

#### Scenario: Bulk history clear reports the deletion and preservation outcome
- **WHEN** the runtime completes a bulk-clear history request
- **THEN** the response MUST identify how many sessions were deleted for that request
- **AND** the response MUST include the excluded session id when one was preserved
- **AND** the response MUST identify which active session ids were skipped from deletion

### Requirement: Runtime SHALL preserve workspace execution across transport disconnects
The runtime SHALL treat client transport loss as a recoverable observation failure rather than as an implicit stop signal, while preserving explicit stop behavior for user-driven cancellation and session-local activity recovery.

#### Scenario: Stream disconnect does not cancel the active session run
- **WHEN** the client stream for an active session run closes before that run reaches a terminal state
- **THEN** the runtime MUST keep that run alive
- **AND** the runtime MUST NOT treat connection closure by itself as a cancellation request

#### Scenario: Explicit stop cancels only the addressed session run
- **WHEN** the client issues an explicit stop or cancel request for a specific active session run
- **THEN** the runtime MUST cancel that run
- **AND** the runtime MUST release only that session's active state after the run reaches its terminal cancellation state

#### Scenario: Runtime bootstrap exposes current-session activity metadata
- **WHEN** the workbench requests runtime bootstrap for a session that currently has an active run or an unresolved pending question
- **THEN** the runtime bootstrap response MUST include whether that session is active
- **AND** the response MUST identify that session's activity state
- **AND** the response MUST include the active run id when a run is currently in flight

#### Scenario: Runtime bootstrap does not convert another session into a global block
- **WHEN** the workbench requests runtime bootstrap for a session that is idle while another session in the same `user + agent` workspace is active
- **THEN** the runtime MUST continue reporting the requested session as idle
- **AND** the runtime MUST NOT surface another session as a global owner that blocks new runs for the requested session

## REMOVED Requirements

### Requirement: Runtime SHALL enforce single active execution ownership for each shared workspace
**Reason**: The product now allows multiple sessions within the same shared `user + agent` workspace to run concurrently, so execution gating is no longer defined by a workspace-global single-owner lock.
**Migration**: Replace `user + agent` occupancy checks with session-scoped active-run and pending-question tracking, and update runtime metadata surfaces to report session-local activity instead of a single workspace owner.

### Requirement: Runtime SHALL reject destructive session-history mutations while the workspace is occupied
**Reason**: Destructive history actions are no longer blocked by another session's activity. Only the targeted active session is protected, and bulk-clear now skips active sessions instead of failing globally.
**Migration**: Reject delete only when the addressed session is active, and make bulk-clear delete idle sessions while preserving the excluded current session and any active sessions.

## ADDED Requirements

### Requirement: Runtime SHALL track active execution independently for each session within a shared workspace
The runtime SHALL admit concurrent runs for different sessions that share the same `user + agent` workspace, while keeping active-run and pending-question responsibility scoped to the owning session.

#### Scenario: Different sessions in the same shared workspace can run concurrently
- **WHEN** one session already has an active run for a given `user + agent` workspace and another session submits a new run for that same workspace
- **THEN** the runtime MUST admit the second session's run
- **AND** the runtime MUST track those sessions' active states independently

#### Scenario: The same session cannot start a second concurrent run
- **WHEN** a session already has an active run and that same session submits another run
- **THEN** the runtime MUST reject the second run with an explicit conflict response
- **AND** the runtime MUST NOT create a second concurrent run for that session

#### Scenario: Unresolved pending question blocks only the owning session
- **WHEN** a session has raised a pending question that still requires an answer or rejection
- **THEN** the runtime MUST reject ordinary new-run admission for that same session
- **AND** the runtime MUST continue allowing different sessions in the same shared workspace to start runs

#### Scenario: Different workspaces remain independently admissible
- **WHEN** two run requests target different workspace scopes because the authenticated user differs or the selected agent differs
- **THEN** the runtime MUST evaluate session activity independently for those scopes
- **AND** activity within one workspace MUST NOT block the other workspace from starting a run
