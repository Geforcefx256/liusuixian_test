## MODIFIED Requirements

### Requirement: Workbench SHALL complete the question-tool interaction loop
The workbench SHALL support interactive question-tool protocol messages that use `form` components and `question_response` actions without surfacing the protocol body or answer payload as a normal raw JSON chat bubble. The workbench SHALL require explicit completion of required question inputs instead of treating protocol defaults as user-confirmed answers.

#### Scenario: Required question cannot be submitted with empty answer
- **WHEN** a question protocol message marks its answer as required
- **AND** the user attempts to submit without providing the necessary input
- **THEN** the workbench MUST block submission locally
- **AND** the conversation surface MUST show explicit feedback that required information is missing

#### Scenario: Required select field requires explicit user choice
- **WHEN** a question protocol message contains a required `select` field
- **THEN** the workbench MUST treat that field as unanswered until the user explicitly chooses one of the allowed options
- **AND** the workbench MUST NOT treat a protocol-rendered initial placeholder or unset value as a valid answer

#### Scenario: Field-level required overrides question default
- **WHEN** a question protocol message contains multiple form fields with mixed `required` settings
- **THEN** the workbench MUST evaluate requiredness per field using field-level metadata before falling back to the question-level default
- **AND** submission blocking MUST apply only to the fields that resolve to required

#### Scenario: Question response submits through the active session conversation loop
- **WHEN** the user submits a valid `question_response` action from a question protocol message
- **THEN** the workbench MUST send the resolved `{ questionId, answer }` payload through the active session runtime flow
- **AND** the frontend MUST avoid presenting that technical payload or the protocol body itself as a normal raw JSON chat bubble

#### Scenario: Question message converges after successful submit
- **WHEN** a question-response submission succeeds
- **THEN** the original protocol message MUST reflect that the question has been submitted
- **AND** the workbench MUST prevent that exact question action from remaining as an immediately repeatable submit action after reload
