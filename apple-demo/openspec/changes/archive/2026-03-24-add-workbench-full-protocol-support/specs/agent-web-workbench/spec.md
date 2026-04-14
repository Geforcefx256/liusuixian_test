## MODIFIED Requirements

### Requirement: Workbench SHALL render planner protocol messages inside the conversation stream
The workbench SHALL render protocol messages directly in the conversation stream and SHALL support the broader workbench protocol component surface required by migrated runtime flows, including `text`, `list`, `form`, `table`, and `button-group` components.

#### Scenario: Protocol message renders form and button-group components in the stream
- **WHEN** the conversation contains a protocol message with `text`, `form`, and `button-group` components
- **THEN** the conversation surface MUST render those components within the standard message stream
- **AND** the user MUST be able to interact with rendered fields and buttons without leaving the workbench conversation shell

#### Scenario: Protocol message renders editable or read-only table components safely
- **WHEN** the conversation contains a protocol message with a `table` component
- **THEN** the conversation surface MUST render the table structure in the message body
- **AND** editable tables MUST preserve user edits as protocol runtime state rather than collapsing back to plain text

#### Scenario: Unsupported protocol subtype falls back safely
- **WHEN** the workbench receives a protocol message that contains unsupported component kinds
- **THEN** the conversation surface MUST degrade safely without breaking the message list
- **AND** the unsupported payload MUST NOT prevent supported protocol components in the same message from rendering

### Requirement: Workbench SHALL persist interactive protocol UI state
The workbench SHALL persist protocol UI state changes for interactive messages through the backend session-message protocol-state contract and SHALL recover richer protocol snapshots such as form state, selection state, table state, and converged message overrides after reload.

#### Scenario: Protocol state survives reload of the same session
- **WHEN** a user interacts with a protocol message in a way that changes its tracked UI state
- **THEN** the frontend MUST persist that updated protocol state to the backend for the owning session message
- **AND** reloading the same session later MUST allow the workbench to recover that protocol state for rendering

#### Scenario: Reload uses persisted message override after an interactive protocol action
- **WHEN** an earlier protocol action persists a converged message snapshot in protocol state
- **THEN** the workbench MUST render that persisted message snapshot when the session is reloaded
- **AND** the frontend MUST NOT revive stale interactive controls from the original protocol payload for that message

## ADDED Requirements

### Requirement: Workbench SHALL execute protocol actions through a general protocol runtime
The workbench SHALL execute protocol actions through a reusable protocol runtime that can assemble runtime state, resolve placeholders, and dispatch supported action types including `submit`, `cancel`, `tool`, `redirect`, and `delegate`.

#### Scenario: Submit action resolves runtime placeholders from form state
- **WHEN** a protocol action contains placeholder-based tool input that references current protocol form state
- **THEN** the workbench MUST resolve those placeholders against the current message runtime state before dispatch
- **AND** the dispatched action payload MUST reflect the user-entered values rather than unresolved placeholder strings

#### Scenario: Redirect action changes the visible protocol message state
- **WHEN** a protocol action requests a redirect to another component or view state within the same protocol message
- **THEN** the workbench MUST update the visible protocol message accordingly
- **AND** the redirected state MUST be eligible for persistence and reload recovery

### Requirement: Workbench SHALL complete the question-tool interaction loop
The workbench SHALL support interactive question-tool protocol messages that use `form` components and `question_response` actions.

#### Scenario: Required question cannot be submitted with empty answer
- **WHEN** a question protocol message marks its answer as required
- **AND** the user attempts to submit without providing the necessary input
- **THEN** the workbench MUST block submission locally
- **AND** the conversation surface MUST show explicit feedback that required information is missing

#### Scenario: Question response submits through the active session conversation loop
- **WHEN** the user submits a valid `question_response` action from a question protocol message
- **THEN** the workbench MUST send the resolved `{ questionId, answer }` payload through the active session runtime flow
- **AND** the frontend MUST avoid presenting the raw technical JSON payload as a normal user-authored chat bubble

#### Scenario: Question message converges after successful submit
- **WHEN** a question-response submission succeeds
- **THEN** the original protocol message MUST reflect that the question has been submitted
- **AND** the workbench MUST prevent that exact question action from remaining as an immediately repeatable submit action after reload

### Requirement: Workbench SHALL provide explicit compatibility handling for workbook-coupled protocol tool actions
The workbench SHALL provide explicit compatibility behavior for workbook-coupled protocol tool actions such as gateway invocation and row-modification flows.

#### Scenario: Workbook-backed tool action executes when the required runtime context is available
- **WHEN** a protocol tool action requires workbook or gateway runtime context
- **AND** the current workbench state has the required compatible context
- **THEN** the workbench MUST execute that action through the governed runtime path
- **AND** the resulting protocol or status changes MUST be reflected in the conversation stream

#### Scenario: Workbook-backed tool action fails with governed compatibility feedback when context is missing
- **WHEN** a workbook-coupled protocol tool action is triggered without the required compatible workbench context
- **THEN** the workbench MUST show explicit governed feedback explaining that the current context cannot execute the action
- **AND** the frontend MUST NOT fall back to a generic unsupported-action error for that case
