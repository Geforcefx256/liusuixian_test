## ADDED Requirements

### Requirement: Runtime SHALL expose structured failure feedback for user-safe workbench rendering
The runtime SHALL expose structured failure metadata for model and tool errors so that the workbench can render user-safe summaries by default while retaining technical detail for diagnostics.

#### Scenario: Model-stage runtime errors include user-safe summary and separate diagnostic detail
- **WHEN** a run fails due to a model transport failure, timeout, or stream interruption
- **THEN** the runtime MUST emit a structured runtime error that includes a user-facing summary suitable for direct workbench display
- **AND** any lower-level diagnostic detail for that failure MUST remain available separately from the user-facing summary

#### Scenario: Terminal tool failures include tool-specific structured metadata
- **WHEN** a tool failure becomes terminal for the current run
- **THEN** the runtime MUST emit structured terminal failure metadata that includes the tool stage, user-facing summary, and tool identity needed by the workbench
- **AND** the runtime MUST expose terminal classification metadata such as stop reason or normalized failure code when that metadata exists

### Requirement: Runtime SHALL stream visible tool failure progress states to the workbench
The runtime SHALL expose non-terminal tool failure progress as stream events so that the workbench can distinguish retrying or recovering tool activity from terminal failure.

#### Scenario: Recoverable tool failure emits recovery progress event
- **WHEN** a tool invocation fails but the runtime chooses to retry or recover instead of terminating the run
- **THEN** the runtime MUST emit a stream event that identifies the tool failure as non-terminal recovery progress
- **AND** that event MUST include the tool identity and user-facing status text required for the workbench to update the active assistant process state

#### Scenario: Terminal tool failure does not rely on recovery-progress semantics
- **WHEN** a tool invocation fails and the runtime stops the run instead of continuing recovery
- **THEN** the runtime MUST terminate the run with terminal failure metadata rather than only emitting a recovery-progress event
- **AND** the terminal error path MUST remain sufficient for the workbench to render final failure feedback without inferring outcome from logs or raw text
