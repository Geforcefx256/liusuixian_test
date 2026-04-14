## ADDED Requirements

### Requirement: Workbench conversation messages SHALL preserve structured message types
The authenticated workbench SHALL preserve structured assistant message types from the backend so that conversation rendering and interaction do not depend on flattening all assistant output into plain text.

#### Scenario: Persisted protocol message remains structured after session load
- **WHEN** the frontend loads session history and a persisted assistant message is returned with `kind: "protocol"`
- **THEN** the workbench MUST preserve that message as a protocol-capable message in frontend state
- **AND** the frontend MUST NOT discard its protocol payload or protocol state during session-message mapping

#### Scenario: Terminal structured result remains distinguishable from plain text
- **WHEN** a completed run returns a structured result payload such as a row-preview result, artifact reference, or structured runtime failure context
- **THEN** the workbench MUST preserve enough structure to render a richer message surface
- **AND** the frontend MUST NOT rely solely on the plain `text` field to decide how to present that result

### Requirement: Workbench SHALL render planner protocol messages inside the conversation stream
The workbench SHALL render the current planner protocol subset directly in the conversation stream for protocol messages that contain `text`, `list`, and `actions` components.

#### Scenario: Planner protocol renders title, lists, and actions
- **WHEN** the conversation contains a planner-generated protocol message with `text`, `list`, and `actions` components
- **THEN** the conversation surface MUST render those components in the message body
- **AND** the message MUST remain part of the standard conversation stream rather than opening a separate planner page or assistant sidebar

#### Scenario: Unsupported protocol subtype falls back safely
- **WHEN** the workbench receives a protocol message that contains unsupported component kinds
- **THEN** the conversation surface MUST degrade safely without breaking the message list
- **AND** the unsupported payload MUST NOT prevent supported protocol components in the same message from rendering

### Requirement: Workbench SHALL complete the plan approval and revision loop from protocol actions
The workbench SHALL allow users to approve or revise the current planner output directly from the protocol message that owns the plan decision actions.

#### Scenario: User approves a plan with no unresolved planning questions
- **WHEN** the active conversation contains a plan protocol message whose action requests `decision: "approve"`
- **AND** the backend accepts that decision
- **THEN** the frontend MUST invoke the runtime plan-decision flow for the active session
- **AND** the workbench MUST refresh visible session plan state after the decision succeeds
- **AND** the conversation surface MUST reflect that the plan has been approved for execution

#### Scenario: User keeps the plan in revise mode
- **WHEN** the active conversation contains a plan protocol message whose action requests `decision: "revise"`
- **AND** the backend accepts that decision
- **THEN** the workbench MUST keep the session in planner mode
- **AND** the conversation surface MUST reflect that the user chose to continue revising the plan

#### Scenario: Approval blocked by unresolved planning questions
- **WHEN** the user attempts to approve a plan that still has unresolved planning questions
- **THEN** the workbench MUST show explicit feedback that approval is blocked
- **AND** the frontend MUST NOT pretend the plan was approved locally

### Requirement: Workbench SHALL persist interactive protocol UI state
The workbench SHALL persist protocol UI state changes for interactive messages through the backend session-message protocol-state contract.

#### Scenario: Protocol state survives reload of the same session
- **WHEN** a user interacts with a protocol message in a way that changes its tracked UI state
- **THEN** the frontend MUST persist that updated protocol state to the backend for the owning session message
- **AND** reloading the same session later MUST allow the workbench to recover that protocol state for rendering

### Requirement: Workbench SHALL present a first batch of rich conversation results
The workbench SHALL present the first batch of rich result surfaces for structured runtime outputs and structured runtime failures without introducing a separate assistant cockpit.

#### Scenario: Structured row result renders as a conversation result card
- **WHEN** a completed run returns a structured row-preview result
- **THEN** the conversation surface MUST render a table-like preview card in the message stream
- **AND** the user MUST still be able to read the surrounding conversation normally

#### Scenario: Artifact reference renders as a conversation artifact card
- **WHEN** a completed run returns an artifact reference result
- **THEN** the conversation surface MUST render a dedicated artifact-oriented message card rather than leaving the payload as raw JSON text

#### Scenario: Structured runtime failure renders as an error card
- **WHEN** a run fails and returns structured runtime failure metadata
- **THEN** the workbench MUST render an explicit failure-oriented message or card
- **AND** the user-facing error presentation MUST be more specific than a generic status string alone
