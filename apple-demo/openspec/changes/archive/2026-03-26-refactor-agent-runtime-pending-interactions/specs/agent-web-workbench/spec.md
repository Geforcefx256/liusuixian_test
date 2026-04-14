## REMOVED Requirements

### Requirement: Workbench SHALL complete the question-tool interaction loop
**Reason**: Question interactions no longer depend on protocol `form` messages and `question_response` actions as the primary frontend contract.
**Migration**: Render unresolved questions from the pending interaction runtime, answer them through dedicated reply/reject actions, and continue the task through a continuation run in the same session.

## ADDED Requirements

### Requirement: Workbench SHALL recover pending question interactions for the active session
The workbench SHALL load and render unresolved question interactions from the runtime as first-class session state rather than reconstructing active questions only from protocol messages.

#### Scenario: Refresh restores the pending question for the active session
- **WHEN** the user refreshes the page while the active session still has an unresolved question interaction
- **THEN** the workbench MUST reload that pending interaction for the same session
- **AND** the user MUST be able to continue answering it without manually re-triggering the agent

#### Scenario: Backend restart does not erase the pending question UI
- **WHEN** the backend process has restarted after persisting a pending question interaction and the user later reopens the same session
- **THEN** the workbench MUST render the restored pending question from the backend interaction contract
- **AND** the frontend MUST NOT depend on an in-memory pre-restart protocol message state in order to recover that question

### Requirement: Workbench SHALL answer pending question interactions through dedicated interaction actions
The workbench SHALL submit question answers and rejections through dedicated interaction actions instead of sending them as generic chat input or as protocol `question_response` tool payloads.

#### Scenario: Valid answer resolves the pending question and starts continuation
- **WHEN** the user submits a valid answer for a pending question interaction
- **THEN** the workbench MUST call the dedicated interaction-reply path for that interaction
- **AND** the workbench MUST start or request a continuation run in the same session after the reply succeeds

#### Scenario: Invalid answer is blocked before reply dispatch
- **WHEN** the user attempts to submit a pending question interaction without satisfying required fields or allowed values
- **THEN** the workbench MUST block submission locally when it can determine the answer is incomplete
- **AND** the frontend MUST NOT fall back to sending that partial answer as generic conversation input

#### Scenario: User rejects the pending question explicitly
- **WHEN** the user chooses to reject a pending question interaction
- **THEN** the workbench MUST call the dedicated interaction-reject path for that interaction
- **AND** the UI MUST reflect that the pending question has been resolved without pretending that an answer was accepted

### Requirement: Workbench SHALL present awaiting-interaction runs without protocol-question bubbles
The workbench SHALL treat runs that pause for question input as awaiting-interaction state rather than as completed protocol question messages in the conversation stream.

#### Scenario: Awaiting-interaction run surfaces question UI without protocol message dependency
- **WHEN** an active run pauses because the runtime is waiting for a pending question interaction
- **THEN** the workbench MUST surface that waiting state through the pending interaction UI for the session
- **AND** the frontend MUST NOT require a protocol question card in the message list in order to let the user answer

#### Scenario: Continuation avoids replaying technical answer payloads as user chat bubbles
- **WHEN** the user answers a pending question and the workbench starts the continuation run
- **THEN** the conversation surface MUST avoid showing the raw technical reply payload as a normal user chat bubble
- **AND** the resumed assistant flow MUST appear as continuation of the same session task rather than as an unrelated fresh conversation branch
