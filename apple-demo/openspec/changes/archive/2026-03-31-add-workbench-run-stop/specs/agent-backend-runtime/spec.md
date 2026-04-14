## ADDED Requirements

### Requirement: Runtime SHALL support explicit cancellation of the current active run
The runtime SHALL allow an authenticated browser client to request cancellation of the current active run by `runId` without broadening that action into a session-wide reset.

#### Scenario: Active run is cancelled by explicit run-scoped request
- **WHEN** the client issues a cancel request for a run that is still active
- **THEN** the runtime MUST apply cancellation to that run only
- **AND** the runtime MUST eventually expose a terminal cancellation outcome through the existing run lifecycle contract unless a different authoritative terminal state for that run has already been committed

#### Scenario: Cancel request for a non-active run is an acknowledged no-op
- **WHEN** the client issues a cancel request for a run that is already finished, already cancelled, or otherwise no longer active
- **THEN** the runtime MUST respond without mutating session history or affecting other runs
- **AND** the response MUST indicate that no active run was cancelled

### Requirement: Runtime SHALL preserve committed session state when cancellation loses a persistence race
The runtime SHALL treat already-committed session state as authoritative even when a cancellation request arrives before the browser has fully converged the turn.

#### Scenario: Pending question interaction remains authoritative after late cancellation
- **WHEN** a run has already persisted a pending question interaction before cancellation is observed
- **THEN** the runtime MUST preserve that interaction as authoritative session state
- **AND** subsequent session reloads MUST continue to expose the session as waiting on that interaction rather than implying that cancellation rolled it back

#### Scenario: Saved plan state remains authoritative after late cancellation
- **WHEN** a run has already persisted plan state or related session metadata before cancellation is observed
- **THEN** the runtime MUST preserve that saved plan/session state
- **AND** cancellation MUST NOT rewrite session metadata or persisted messages to pretend the plan was never created

#### Scenario: Cancellation does not imply rollback of prior mutating tool side effects
- **WHEN** a mutating tool or governed execution path has already produced workspace or external side effects before cancellation is observed
- **THEN** the runtime MUST NOT claim that those side effects were rolled back merely because the run later reports cancellation
- **AND** browser clients MUST remain able to distinguish cancellation from rollback semantics
