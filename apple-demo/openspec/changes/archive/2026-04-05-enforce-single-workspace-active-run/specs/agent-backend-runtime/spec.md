## ADDED Requirements

### Requirement: Runtime SHALL enforce single active execution ownership for each shared workspace
The runtime SHALL admit at most one execution owner for each `user + agent` workspace so that shared workspace files, outputs, and follow-up interaction state cannot be mutated concurrently by multiple sessions.

#### Scenario: Second session run is rejected instead of queued
- **WHEN** one session already owns active execution for a given `user + agent` workspace and another session submits a new run for that same workspace
- **THEN** the runtime MUST reject the second run with an explicit conflict response
- **AND** the runtime MUST NOT queue that second run behind the current owner session

#### Scenario: Unresolved pending question keeps the workspace occupied
- **WHEN** the current owner session has raised a pending question that still requires an answer or rejection
- **THEN** the runtime MUST continue treating that `user + agent` workspace as occupied for new-run admission
- **AND** other sessions for that same workspace MUST still be rejected from starting runs

#### Scenario: Different workspaces remain independently admissible
- **WHEN** two run requests target different workspace scopes because the authenticated user differs or the selected agent differs
- **THEN** the runtime MUST evaluate active-execution ownership independently for those scopes
- **AND** the occupied state of one workspace MUST NOT block the other workspace from starting a run

### Requirement: Runtime SHALL preserve workspace execution across transport disconnects
The runtime SHALL treat client transport loss as a recoverable observation failure rather than as an implicit stop signal, while preserving explicit stop behavior for user-driven cancellation.

#### Scenario: Stream disconnect does not cancel the active run
- **WHEN** the client stream for an active run closes before that run reaches a terminal state
- **THEN** the runtime MUST keep the run alive
- **AND** the runtime MUST NOT treat connection closure by itself as a cancellation request

#### Scenario: Explicit stop cancels the active run
- **WHEN** the client issues an explicit stop or cancel request for the active workspace run
- **THEN** the runtime MUST cancel that run
- **AND** the runtime MUST release workspace occupancy only after the run reaches its terminal cancellation state

#### Scenario: Runtime bootstrap exposes shared-workspace occupancy metadata
- **WHEN** the workbench requests runtime bootstrap for a `user + agent` workspace that currently has an active run or an unresolved pending question
- **THEN** the runtime bootstrap response MUST include whether the workspace is occupied
- **AND** the response MUST identify the owning session id
- **AND** the response MUST include the active run id when a run is currently in flight

### Requirement: Runtime SHALL reject destructive session-history mutations while the workspace is occupied
The runtime SHALL protect session persistence from concurrent destructive history actions while any session still owns execution or unresolved follow-up responsibility for the shared workspace.

#### Scenario: Session delete is rejected during occupied workspace execution
- **WHEN** a client requests deletion of any session for a `user + agent` workspace that is currently occupied by an active run or unresolved pending question
- **THEN** the runtime MUST reject that deletion with an explicit conflict response
- **AND** the runtime MUST NOT delete persisted session state for that request

#### Scenario: Bulk history clear is rejected during occupied workspace execution
- **WHEN** a client requests bulk-clear history for a `user + agent` workspace that is currently occupied by an active run or unresolved pending question
- **THEN** the runtime MUST reject that bulk-clear request with an explicit conflict response
- **AND** the runtime MUST NOT delete persisted sessions for that request
