## ADDED Requirements

### Requirement: Runtime SHALL degrade exhausted local-question validation loops into plain assistant text
The runtime SHALL convert repeated `local:question` validation failures into a plain assistant text response once the configured model-recovery budget for that same tool-call chain is exhausted, instead of leaving the user at a terminal runtime tool failure.

#### Scenario: Exhausted question validation loop becomes visible assistant text
- **WHEN** a `local:question` tool-call chain fails with `question_validation_error`
- **AND** the runtime reaches `model_recovery_exhausted` for that same chain
- **THEN** the runtime MUST append exactly one assistant text message that tells the user structured question collection failed and that plain-text collection is now in use
- **AND** the runtime MUST end that run with the degraded assistant output instead of returning a terminal runtime tool failure to the client

#### Scenario: Degraded question path does not create pending interaction state
- **WHEN** the runtime degrades an exhausted `local:question` validation loop into plain assistant text
- **THEN** the runtime MUST NOT create a pending question interaction, awaiting-interaction result, or question-response continuation contract for that degraded branch
- **AND** the session MUST remain eligible for the user's next ordinary chat input

#### Scenario: User reply after degradation is treated as ordinary input
- **WHEN** a user replies after the runtime has emitted the degraded plain-text question message
- **THEN** the next run MUST treat that reply as ordinary conversation input
- **AND** the runtime MUST NOT require the client to resume through a `question_response`-style continuation path

## MODIFIED Requirements

### Requirement: Runtime SHALL preserve separate machine-facing and user-facing tool failure payloads
The runtime SHALL provide structured failure data suitable for model recovery while continuing to expose readable runtime failure metadata to frontend consumers. Machine-facing tool error payloads written back into the active conversation MUST prioritize concise correction signals over runtime control metadata. For terminal failures, the runtime SHALL continue to return explicit runtime failure metadata except for the special case where an exhausted `local:question` validation loop is degraded into a plain assistant text response.

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

#### Scenario: Terminal runtime failure preserves user-facing summary for non-degraded failures
- **WHEN** execution terminates because tool retry, model recovery, or no-progress limits are reached
- **AND** the terminating branch is not a degraded `local:question` validation exhaustion path
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
