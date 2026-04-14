## MODIFIED Requirements

### Requirement: Runtime SHALL preserve separate machine-facing and user-facing tool failure payloads
The runtime SHALL provide structured failure data suitable for model recovery while continuing to expose readable runtime failure metadata to frontend consumers. Machine-facing tool error payloads written back into the active conversation MUST prioritize concise correction signals over runtime control metadata.

#### Scenario: Recoverable tool failure emits minimal correction payload
- **WHEN** a recoverable tool failure is written back into the conversation
- **THEN** the payload MUST include a stable error code, recoverable flag, retry-oriented metadata, and a concise error summary sufficient for the model to attempt correction
- **AND** the payload MUST avoid including unrelated runtime control metadata that does not help the model choose the next corrective tool call

#### Scenario: Tool error payload may include structured delta hints when reliably known
- **WHEN** the runtime or tool-specific validator can determine a stable field-level correction hint for a recoverable tool failure
- **THEN** the machine-facing payload MAY include structured delta fields such as failing field, expected shape, actual shape, or a short fix hint
- **AND** those fields MUST be omitted rather than guessed when the runtime cannot determine them reliably

#### Scenario: Runtime control metadata remains available outside the conversation payload
- **WHEN** a recoverable or terminal tool failure produces stop, retry, or chain diagnostics
- **THEN** the runtime MUST preserve that diagnostic metadata in runtime error and observability surfaces where applicable
- **AND** the runtime MUST NOT require the active conversation payload to mirror those same control fields

#### Scenario: Terminal runtime failure preserves user-facing summary
- **WHEN** execution terminates because tool retry, model recovery, or no-progress limits are reached
- **THEN** the runtime MUST return structured runtime failure metadata with a frontend-consumable summary
- **AND** the returned metadata MUST remain distinguishable from the machine-facing tool error payload used inside the conversation loop

#### Scenario: Terminal runtime failure exposes explicit stop reason
- **WHEN** execution terminates because the runtime reached a terminal tool failure, recovery exhaustion, or no-progress stop
- **THEN** the runtime MUST return a structured stop reason in terminal runtime failure metadata
- **AND** that metadata MUST identify the tool name and normalized failure code that caused the stop

#### Scenario: Tool denial stays terminal and visible in logs
- **WHEN** a tool invocation fails with a deny-style outcome such as `TOOL_DENIED`
- **THEN** the runtime MUST terminate that tool invocation as a terminal failure instead of offering model recovery
- **AND** the runtime MUST record log fields sufficient to identify that the stop was caused by a deny decision and where that deny originated
