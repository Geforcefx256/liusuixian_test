## MODIFIED Requirements

### Requirement: Workbench SHALL render a transient assistant status header for the active conversation view
The authenticated workbench SHALL render a compact status header above assistant message bodies in the active conversation view so the user can see a coarse execution cue during the current turn and a lightweight execution summary after completion.

#### Scenario: Active assistant placeholder shows a coarse in-flight status
- **WHEN** the user submits a prompt and the workbench creates the active assistant placeholder for that turn
- **THEN** the conversation surface MUST render a compact status header above that assistant message body
- **AND** the header MUST present a coarse in-flight status such as queued, thinking, or generating rather than a detailed execution timeline
- **AND** the workbench MUST NOT render that header for user-authored messages

#### Scenario: Tool-assisted turn converges to a compact execution summary
- **WHEN** a completed run returns successfully and the terminal run metrics report one or more tool invocations
- **THEN** the assistant header MUST converge to a short tool-assisted summary for that turn
- **AND** the summary MUST be able to mention the compact tool list without requiring a separate timeline or expanded trace panel

#### Scenario: Interactive or structured turn converges to an outcome-oriented summary
- **WHEN** a completed run returns a terminal output whose kind is `protocol` or `domain-result`
- **THEN** the assistant header MUST converge to a short outcome-oriented summary that reflects that interactive step or structured result
- **AND** the underlying protocol card or rich result message body MUST continue to render through the existing structured message surface

#### Scenario: Awaiting-interaction turn header recovers after user answers the question
- **WHEN** a completed run returns a terminal output whose kind is `awaiting-interaction` and the assistant header shows a waiting-confirmation summary
- **AND** the user subsequently submits an answer through the pending question interaction
- **THEN** the assistant header for that awaiting-interaction message MUST update to an answered summary
- **AND** the header update MUST NOT depend on state stored inside `sessionActivityById` because that state is overwritten by session-list synchronization after each run

#### Scenario: Awaiting-interaction turn header recovers after user rejects the question
- **WHEN** a completed run returns a terminal output whose kind is `awaiting-interaction` and the assistant header shows a waiting-confirmation summary
- **AND** the user subsequently rejects the pending question interaction
- **THEN** the assistant header for that awaiting-interaction message MUST update to a task-ended summary
- **AND** the header update MUST NOT depend on state stored inside `sessionActivityById`

#### Scenario: Failed turn converges to an explicit failure status
- **WHEN** the active run ends with a runtime failure or terminal error result
- **THEN** the assistant header MUST converge to an explicit failed status for that turn
- **AND** the workbench MUST continue to render the failure-oriented assistant body without relying on the header alone as the only user-visible error signal

#### Scenario: Same-session refresh retains the current-turn header without persisting it to history
- **WHEN** the frontend refreshes the currently active session immediately after a completed run in order to reload authoritative session state
- **THEN** the workbench MUST be able to retain the current-turn assistant header presentation for that active view without requiring backend-persisted session history to store intermediate header state
- **AND** the system MUST NOT require that transient header state to remain recoverable after the user later switches sessions or reopens history
