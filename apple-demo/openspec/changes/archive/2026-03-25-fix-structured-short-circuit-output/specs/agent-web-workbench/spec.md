## ADDED Requirements

### Requirement: Workbench SHALL converge short-circuit structured runs from terminal structured state
The workbench SHALL treat terminal structured run results as authoritative for short-circuit protocol and domain-result runs, even when those runs do not stream a raw assistant text body.

#### Scenario: Protocol short-circuit run completes without raw assistant text stream
- **WHEN** an active run completes with a protocol short-circuit result
- **THEN** the workbench MUST be able to converge the in-flight assistant placeholder into a protocol-capable message from the terminal structured result
- **AND** the frontend MUST NOT require a raw JSON `assistant.delta` or `assistant.final` text payload to render that message correctly

#### Scenario: Domain-result short-circuit run completes without raw assistant text stream
- **WHEN** an active run completes with a structured domain result short-circuit output such as an artifact reference
- **THEN** the workbench MUST be able to converge the in-flight assistant placeholder into the corresponding rich result message from the terminal structured result
- **AND** the frontend MUST NOT require a raw JSON `assistant.delta` or `assistant.final` text payload to render that result correctly

## MODIFIED Requirements

### Requirement: Workbench conversation messages SHALL preserve structured message types
The authenticated workbench SHALL preserve structured assistant message types from the backend so that conversation rendering and interaction do not depend on flattening all assistant output into plain text or reparsing raw assistant JSON text.

#### Scenario: Persisted protocol message remains structured after session load
- **WHEN** the frontend loads session history and a persisted assistant message is returned with `kind: "protocol"`
- **THEN** the workbench MUST preserve that message as a protocol-capable message in frontend state
- **AND** the frontend MUST NOT discard its protocol payload or protocol state during session-message mapping

#### Scenario: Persisted domain-result message remains structured after session load
- **WHEN** the frontend loads session history and a persisted assistant message is returned with `kind: "result"` for a structured domain result
- **THEN** the workbench MUST preserve that message as a rich result message in frontend state
- **AND** the frontend MUST NOT fall back to presenting the raw JSON text body as the primary visible message

#### Scenario: Terminal structured result remains distinguishable from plain text
- **WHEN** a completed run returns a structured result payload such as a row-preview result, artifact reference, or structured runtime failure context
- **THEN** the workbench MUST preserve enough structure to render a richer message surface
- **AND** the frontend MUST NOT rely solely on the plain `text` field to decide how to present that result

### Requirement: Workbench SHALL present a first batch of rich conversation results
The workbench SHALL present the first batch of rich result surfaces for structured runtime outputs and structured runtime failures without introducing a separate assistant cockpit or leaking raw structured JSON as a normal assistant bubble.

#### Scenario: Structured row result renders as a conversation result card
- **WHEN** a completed run returns a structured row-preview result
- **THEN** the conversation surface MUST render a table-like preview card in the message stream
- **AND** the user MUST still be able to read the surrounding conversation normally

#### Scenario: Artifact reference renders as a conversation artifact card
- **WHEN** a completed run or reloaded session returns an artifact reference result
- **THEN** the conversation surface MUST render a dedicated artifact-oriented message card rather than leaving the payload as raw JSON text

#### Scenario: Structured runtime failure renders as an error card
- **WHEN** a run fails and returns structured runtime failure metadata
- **THEN** the workbench MUST render an explicit failure-oriented message or card
- **AND** the user-facing error presentation MUST be more specific than a generic status string alone

### Requirement: Workbench SHALL complete the question-tool interaction loop
The workbench SHALL support interactive question-tool protocol messages that use `form` components and `question_response` actions without surfacing the protocol body or answer payload as a normal raw JSON chat bubble.

#### Scenario: Required question cannot be submitted with empty answer
- **WHEN** a question protocol message marks its answer as required
- **AND** the user attempts to submit without providing the necessary input
- **THEN** the workbench MUST block submission locally
- **AND** the conversation surface MUST show explicit feedback that required information is missing

#### Scenario: Question response submits through the active session conversation loop
- **WHEN** the user submits a valid `question_response` action from a question protocol message
- **THEN** the workbench MUST send the resolved `{ questionId, answer }` payload through the active session runtime flow
- **AND** the frontend MUST avoid presenting that technical payload or the protocol body itself as a normal raw JSON chat bubble

#### Scenario: Question message converges after successful submit
- **WHEN** a question-response submission succeeds
- **THEN** the original protocol message MUST reflect that the question has been submitted
- **AND** the workbench MUST prevent that exact question action from remaining as an immediately repeatable submit action after reload
