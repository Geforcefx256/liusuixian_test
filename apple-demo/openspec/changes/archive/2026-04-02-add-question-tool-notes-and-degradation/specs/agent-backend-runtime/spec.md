## ADDED Requirements

### Requirement: Runtime SHALL expose a stable notes companion field for select question interactions
The runtime SHALL attach exactly one optional `notes` text field to every pending question interaction that contains at least one `select` field so users can submit supplementary context without changing the structured primary answer.

#### Scenario: Select question payload includes one optional notes field
- **WHEN** the runtime creates a pending question interaction whose visible fields include at least one `select` field
- **THEN** the interaction payload MUST include exactly one additional optional text field for `notes`
- **AND** that `notes` field MUST remain semantically separate from the primary answer field or fields

#### Scenario: Notes field does not replace the structured primary answer
- **WHEN** the runtime validates a reply for a pending select-based question interaction
- **THEN** any submitted `notes` value MUST be treated only as supplementary context
- **AND** the runtime MUST continue to require the structured primary answer fields according to the question contract

### Requirement: Runtime SHALL normalize only lossless string-array question options before validation
The runtime SHALL attempt explicit normalization of malformed `local:question` select options only when the original input can be converted into the canonical options-array shape without guessing.

#### Scenario: Valid JSON string array is normalized explicitly
- **WHEN** a `local:question` invocation provides `options` as a string whose content is a valid JSON array of option objects
- **THEN** the runtime MUST parse that string into the canonical options-array shape before building the question interaction
- **AND** the runtime MUST record an explicit warning or diagnostic that normalization occurred

#### Scenario: Non-lossless malformed options skip normalization
- **WHEN** a `local:question` invocation provides malformed `options` that cannot be parsed as a valid JSON array without guessing
- **THEN** the runtime MUST NOT silently coerce those options into a canonical array
- **AND** the runtime MUST continue into the explicit degraded-question path instead of pretending the original structure was valid

## MODIFIED Requirements

### Requirement: Runtime SHALL degrade exhausted local-question validation loops into plain assistant text
The runtime SHALL convert repeated `local:question` validation failures into an explicit degraded question interaction once the configured model-recovery budget for that same tool-call chain is exhausted, instead of leaving the user at a terminal runtime tool failure or switching the session back to ordinary plain-text chat input.

#### Scenario: Exhausted question validation loop becomes a degraded pending interaction
- **WHEN** a `local:question` tool-call chain fails with `question_validation_error`
- **AND** the runtime reaches `model_recovery_exhausted` for that same chain
- **THEN** the runtime MUST create exactly one degraded pending question interaction rather than appending only a plain assistant text message
- **AND** the degraded interaction MUST remain resumable through the existing reply / reject continuation path

#### Scenario: Degraded interaction preserves user-readable context from the failed question
- **WHEN** the runtime creates a degraded question interaction after exhausting a `local:question` validation loop
- **THEN** the degraded payload MUST preserve the original user-facing `prompt`
- **AND** the payload MUST include a user-readable explanation that structured question collection failed
- **AND** the payload MUST include any reference option text that can be extracted reliably from the malformed input without guessing hidden structure

#### Scenario: Degraded interaction uses text answer plus notes
- **WHEN** the runtime creates a degraded question interaction
- **THEN** the degraded payload MUST expose a required text field for the primary `answer`
- **AND** the degraded payload MUST expose exactly one optional `notes` field for supplementary context

#### Scenario: User reply after degradation resumes through question continuation
- **WHEN** a user replies to the degraded question interaction
- **THEN** the runtime MUST validate and persist that reply through the same question-response continuation path used for other pending interactions
- **AND** the runtime MUST NOT require the client to fall back to ordinary `/agent/run` input for that blocked session

### Requirement: Runtime SHALL preserve separate machine-facing and user-facing tool failure payloads
The runtime SHALL provide structured failure data suitable for model recovery while continuing to expose readable runtime failure metadata to frontend consumers. Machine-facing tool error payloads written back into the active conversation MUST prioritize concise correction signals over runtime control metadata. For terminal failures, the runtime SHALL continue to return explicit runtime failure metadata except for the special case where an exhausted `local:question` validation loop is converted into a degraded pending interaction.

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
