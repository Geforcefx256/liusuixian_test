## ADDED Requirements

### Requirement: Workbench SHALL expose a stop control for the current active run
The authenticated workbench SHALL expose a stop affordance that targets only the currently active run in the selected conversation session.

#### Scenario: Active run exposes stop in the conversation surface
- **WHEN** the selected session has an active run whose authoritative `runId` has been received from the runtime
- **THEN** the conversation surface MUST expose a stop control for that run
- **AND** invoking that control MUST target only that active `runId` rather than resetting the whole session or rewriting prior history

#### Scenario: Stop is unavailable when no active run exists
- **WHEN** the selected session has no active run, has already reached a terminal state, or is waiting on a persisted interaction instead of actively running
- **THEN** the workbench MUST NOT present stop as an available action for that turn
- **AND** the UI MUST avoid implying that historical messages or pending-interaction state can be stopped retroactively

### Requirement: Workbench SHALL converge stop requests against authoritative run and session state
The authenticated workbench SHALL treat stop as a cancellation request whose visible result is determined by the terminal run outcome together with refreshed authoritative session state.

#### Scenario: Stop request enters a pending cancellation state without clearing partial output
- **WHEN** the user clicks stop for the active run
- **THEN** the workbench MUST show that the run is stopping without immediately clearing the current partial assistant output
- **AND** the frontend MUST wait for the authoritative terminal run outcome before deciding how the active turn should converge

#### Scenario: Cancel request failure remains visible
- **WHEN** the stop request fails because the cancel API cannot be reached or returns a transport/HTTP failure
- **THEN** the workbench MUST exit the stopping-pending state and surface an explicit stop failure
- **AND** the frontend MUST NOT silently pretend that the run was cancelled

#### Scenario: Cancel no-op is treated as an acknowledged race, not a stop failure
- **WHEN** the cancel API succeeds but reports that no active run was cancelled
- **THEN** the workbench MUST treat that response as an acknowledged no-op rather than as a terminal error
- **AND** the UI MUST continue converging from the already-authoritative terminal stream state for that run

#### Scenario: Cancelled run with no authoritative persisted side effect becomes transient stopped UI
- **WHEN** the active run reaches a terminal `cancelled` outcome and refreshed session state shows no newer authoritative persisted turn state from that run
- **THEN** the workbench MUST converge the active assistant placeholder to a transient stopped presentation labeled `已停止`
- **AND** the system MUST NOT require that stopped presentation to be persisted in session history or survive a later refresh or session switch

#### Scenario: Persisted awaiting-interaction or plan state wins over transient stopped presentation
- **WHEN** a stop request races with a run that has already persisted authoritative state such as a pending question interaction, saved plan state, or another persisted session artifact for that turn
- **THEN** the workbench MUST refresh and render that authoritative state instead of forcing the turn to appear as `已停止`
- **AND** the UI MUST preserve the fact that stop does not roll back already-persisted side effects
