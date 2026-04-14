## MODIFIED Requirements

### Requirement: Runtime session metadata SHALL support preview-rich workbench history rails
The runtime SHALL expose session-list metadata that is sufficient for the frontend to render a preview-rich history rail, perform explicit session deletion flows, and clear historical sessions in bulk for the active agent without deleting the currently excluded session.

#### Scenario: Session list includes preview-ready metadata
- **WHEN** a client requests the session list for an agent
- **THEN** each returned session item MUST include a stable one-line preview string suitable for history-rail display
- **AND** each returned session item MUST continue to identify the session, title, and update timing needed for rail ordering and selection

#### Scenario: Session deletion removes persisted session state
- **WHEN** a client issues a confirmed delete for a session
- **THEN** the runtime MUST delete the persisted session record for that user and agent
- **AND** the runtime MUST remove persisted messages and related derived session state that belongs exclusively to that deleted session

#### Scenario: Bulk history clear removes all deletable sessions for the active agent
- **WHEN** a client issues a confirmed bulk-clear request for an active agent with an excluded current session id
- **THEN** the runtime MUST delete every persisted session for that authenticated user and active agent except the excluded session
- **AND** the runtime MUST remove persisted messages, summaries, plans, interactions, and session metadata that belong exclusively to each deleted session

#### Scenario: Bulk history clear can preserve no session when none is excluded
- **WHEN** a client issues a confirmed bulk-clear request for an active agent without providing an excluded session id
- **THEN** the runtime MUST treat all persisted sessions for that authenticated user and active agent as deletable targets
- **AND** the runtime MUST return a successful response when those targets are removed

#### Scenario: Bulk history clear reports the deletion outcome
- **WHEN** the runtime completes a bulk-clear history request
- **THEN** the response MUST identify how many sessions were deleted for that request
- **AND** the response MUST include the excluded session id when one was preserved
