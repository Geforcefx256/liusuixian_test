## MODIFIED Requirements

### Requirement: Runtime session-message APIs SHALL preserve protocol message state for the workbench
The runtime SHALL expose session-message payloads and protocol-state update behavior that allow the workbench to recover and persist interactive protocol messages for a session, including richer structured UI state such as form values, list selections, table state, and persisted message overrides.

#### Scenario: Session history returns protocol payload and protocol state
- **WHEN** a client requests session message history for a session that contains a persisted assistant protocol message
- **THEN** the runtime MUST return that message as a protocol-capable message view
- **AND** the message view MUST include any persisted protocol UI state for that message when such state exists

#### Scenario: Protocol state update persists for a specific session message
- **WHEN** a client updates protocol UI state for a valid session message
- **THEN** the runtime MUST persist that protocol state against the addressed session message
- **AND** later reads of the same session message MUST return the updated protocol state

#### Scenario: Rich structured protocol state is preserved without lossy narrowing
- **WHEN** a client persists nested protocol state for form, selection, table, or message-override recovery
- **THEN** the runtime MUST preserve that structured protocol state without flattening it into a note-only representation
- **AND** subsequent reads MUST return enough structure for the frontend to restore the interactive protocol view

## ADDED Requirements

### Requirement: Runtime protocol outputs SHALL remain compatible with question-tool interaction loops
The runtime SHALL continue to expose protocol outputs for interactive question flows in a shape that a full protocol frontend can execute end-to-end.

#### Scenario: Question tool emits form-based protocol output
- **WHEN** a runtime tool requests additional user input through the question flow
- **THEN** the runtime MUST be able to return a protocol message that includes a `form` component for that interaction
- **AND** the corresponding action contract MUST identify the submission path as a `question_response` style tool action

#### Scenario: Question answer returns through the active session conversation loop
- **WHEN** a client later submits a resolved `{ questionId, answer }` payload through the active session conversation flow
- **THEN** the runtime MUST treat that answer as part of the same session interaction loop
- **AND** the runtime MUST allow the next assistant response to continue from that answered state rather than treating it as an unrelated free-form prompt

### Requirement: Runtime SHALL expose stable protocol action contracts for workbook-coupled flows
The runtime SHALL expose stable protocol action contracts for workbook-coupled flows so the workbench can distinguish executable workbook actions from generic protocol tools.

#### Scenario: Workbook-coupled tool action exposes the tool identifier and structured input
- **WHEN** a runtime flow emits a workbook-coupled protocol tool action such as gateway invocation or row modification
- **THEN** the emitted protocol action MUST identify the governed tool route through its tool identifier
- **AND** the emitted action MUST preserve the structured tool input needed by the frontend to decide whether it can execute that action in the current workbench context

#### Scenario: Protocol output remains distinguishable from plain text when workbook actions are present
- **WHEN** a completed run returns a protocol output that includes workbook-coupled actions
- **THEN** the terminal run result MUST continue to identify that output as protocol-capable
- **AND** the runtime MUST preserve the full structured action payload instead of collapsing it into plain text
