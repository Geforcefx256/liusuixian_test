## MODIFIED Requirements

### Requirement: Runtime session metadata SHALL support preview-rich workbench history rails
The runtime SHALL expose session-list metadata that is sufficient for the frontend to render a preview-rich history rail, identify each session's local activity state, perform explicit session deletion flows for idle and active sessions, and clear deletable historical sessions in bulk for the active agent while preserving the currently excluded session and any active sessions.

#### Scenario: Session list includes preview-ready metadata and local activity state
- **WHEN** a client requests the session list for an agent
- **THEN** each returned session item MUST include a stable one-line preview string suitable for history-rail display
- **AND** each returned session item MUST continue to identify the session, title, and update timing needed for rail ordering and selection
- **AND** each returned session item MUST include enough session-local activity metadata for the frontend to distinguish idle, running, stop-pending, and unresolved pending-question sessions

#### Scenario: Idle session deletion removes persisted session state
- **WHEN** a client issues a confirmed delete for a session that does not currently have an active run or an unresolved pending question
- **THEN** the runtime MUST delete the persisted session record for that user and agent
- **AND** the runtime MUST remove persisted messages, summaries, plans, interactions, and session metadata that belong exclusively to that deleted session

#### Scenario: Running or stop-pending session deletion succeeds without waiting for terminal completion
- **WHEN** a client issues a confirmed delete for a session that currently has an active run or is waiting for stop convergence
- **THEN** the runtime MUST accept the delete instead of rejecting it with an occupancy conflict
- **AND** the runtime MUST remove persisted messages, summaries, plans, interactions, and session metadata that belong exclusively to that deleted session
- **AND** the runtime MUST request cancellation of the associated run if one is still active

#### Scenario: Awaiting-question session deletion succeeds and clears pending interaction state
- **WHEN** a client issues a confirmed delete for a session that currently has an unresolved pending question and no active run
- **THEN** the runtime MUST accept the delete instead of rejecting it with an occupancy conflict
- **AND** the runtime MUST remove the persisted pending interaction together with the rest of that session's persisted state
- **AND** the runtime MUST release any local occupancy state that marks the session as awaiting a question response

#### Scenario: Deleted session id cannot be recreated by stale writes
- **WHEN** a stale run, interaction continuation, protocol-state update, plan write, summary write, or session-metadata write arrives after that session has been deleted
- **THEN** the runtime MUST reject that session-scoped write for the deleted `sessionId`
- **AND** the runtime MUST NOT recreate the session record or any session-owned derived data from that stale write

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
