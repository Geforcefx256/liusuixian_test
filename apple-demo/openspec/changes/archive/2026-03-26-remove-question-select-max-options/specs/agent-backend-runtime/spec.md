## MODIFIED Requirements

### Requirement: Runtime protocol outputs SHALL remain compatible with question-tool interaction loops
The runtime SHALL continue to expose protocol outputs for interactive question flows in a shape that a full protocol frontend can execute end-to-end, while keeping the tool-generated protocol payload authoritative over any model-authored imitation content from the same step. The runtime SHALL also prevent question payloads from encoding implicit answers, SHALL accept `select` question fields with any closed-choice option list containing at least 2 items, and SHALL validate returned question answers before continuing the session.

#### Scenario: Question tool emits form-based protocol output
- **WHEN** a runtime tool requests additional user input through the question flow
- **THEN** the runtime MUST be able to return a protocol message that includes a `form` component for that interaction
- **AND** the corresponding action contract MUST identify the submission path as a `question_response` style tool action
- **AND** required `select` fields MUST remain unselected until the user explicitly chooses an option
- **AND** field-level `required` metadata MUST be preserved when the question tool payload defines it

#### Scenario: Question tool accepts closed-choice select lists with at least two options
- **WHEN** `local:question` defines a `select` field or top-level `options` array for a closed-choice question
- **THEN** the runtime MUST accept that payload when the option list contains at least 2 items
- **AND** the runtime MUST NOT reject that payload solely because the option list contains more than 4 items

#### Scenario: Question short-circuit preserves the trusted protocol payload
- **WHEN** a `local:question` call short-circuits a run
- **THEN** the persisted question message MUST use the tool-generated protocol payload as the authoritative structured content
- **AND** the runtime MUST NOT replace that content with a model-authored protocol-like JSON body from the same tool-calls step

#### Scenario: Question answer returns through the active session conversation loop
- **WHEN** a client later submits a resolved `{ questionId, answer }` payload through the active session conversation flow
- **THEN** the runtime MUST treat that answer as part of the same session interaction loop
- **AND** the runtime MUST allow the next assistant response to continue from that answered state rather than treating it as an unrelated free-form prompt

#### Scenario: Runtime rejects mismatched question answers before model continuation
- **WHEN** a client submits a `{ questionId, answer }` payload that does not match the active question protocol contract for the session
- **THEN** the runtime MUST reject that input before continuing the model loop
- **AND** the runtime MUST validate question identity, allowed fields, allowed `select` values, and required fields against the original protocol payload

#### Scenario: Question validation failures remain concise for model recovery
- **WHEN** `local:question` is invoked with an invalid payload that the model can correct
- **THEN** the runtime MUST surface a concise validation error message to the model recovery loop
- **AND** the runtime MUST keep the detailed underlying validation reason available in logs for debugging
