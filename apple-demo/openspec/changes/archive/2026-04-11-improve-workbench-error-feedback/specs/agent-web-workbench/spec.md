## ADDED Requirements

### Requirement: Workbench SHALL present layered runtime failure feedback in the conversation surface
The workbench SHALL present runtime failures with distinct user-facing summary, status feedback, and optional technical detail so that users can understand whether a run is retrying, recovering, cancelled, or terminally failed without reading raw backend error text.

#### Scenario: Model timeout shows user-facing summary instead of raw transport detail
- **WHEN** the active run ends with a model timeout or stream interruption runtime error
- **THEN** the conversation failure card MUST display the structured user-facing runtime summary
- **AND** the workbench MUST NOT display raw transport detail, request URL, or equivalent backend diagnostic text as the default body copy in that card

#### Scenario: Recovering tool failure remains a process state instead of a terminal error card
- **WHEN** the workbench receives a tool failure event that indicates the runtime is retrying or recovering
- **THEN** the active assistant message MUST update its visible process status to communicate recovery in progress
- **AND** the workbench MUST NOT render that intermediate tool failure as a terminal red error card

#### Scenario: Terminal tool failure shows user-safe conclusion with optional technical detail
- **WHEN** the active run ends because a tool failure has become terminal
- **THEN** the workbench MUST render a terminal failure card whose primary message comes from the structured user-facing runtime summary
- **AND** the workbench MUST identify the failure as a tool-stage failure in its visible status treatment
- **AND** any technical detail associated with that failure MUST remain optional rather than displayed as the default message body

#### Scenario: Failure feedback is announced accessibly
- **WHEN** the workbench renders a terminal failure card or an in-progress recovery status update
- **THEN** terminal failure feedback MUST be exposed through an assertive accessible error announcement
- **AND** non-terminal recovery status MUST be exposed through a non-terminal status announcement rather than color-only styling
