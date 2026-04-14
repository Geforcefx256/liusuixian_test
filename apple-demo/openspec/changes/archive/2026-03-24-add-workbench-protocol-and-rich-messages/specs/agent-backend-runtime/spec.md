## ADDED Requirements

### Requirement: Runtime session-message APIs SHALL preserve protocol message state for the workbench
The runtime SHALL expose session-message payloads and protocol-state update behavior that allow the workbench to recover and persist interactive protocol messages for a session.

#### Scenario: Session history returns protocol payload and protocol state
- **WHEN** a client requests session message history for a session that contains a persisted assistant protocol message
- **THEN** the runtime MUST return that message as a protocol-capable message view
- **AND** the message view MUST include any persisted protocol UI state for that message when such state exists

#### Scenario: Protocol state update persists for a specific session message
- **WHEN** a client updates protocol UI state for a valid session message
- **THEN** the runtime MUST persist that protocol state against the addressed session message
- **AND** later reads of the same session message MUST return the updated protocol state

### Requirement: Runtime SHALL expose planner decision APIs that keep session plan state authoritative
The runtime SHALL allow the workbench to approve or revise the current plan through a session-scoped plan-decision API while keeping session plan state authoritative on the backend.

#### Scenario: Approving a plan updates session planner/build state
- **WHEN** a client submits an `approve` decision for a valid session plan
- **THEN** the runtime MUST persist that plan decision
- **AND** the returned session metadata MUST reflect the resulting approved plan state and active primary agent mode

#### Scenario: Revising a plan keeps the session in planning mode
- **WHEN** a client submits a `revise` decision for a valid session plan
- **THEN** the runtime MUST persist that decision
- **AND** the returned session metadata MUST keep the session in planner mode with a draft-style plan state

#### Scenario: Runtime rejects approval while planning questions remain unresolved
- **WHEN** a client submits an `approve` decision for a plan that still contains unresolved planning questions
- **THEN** the runtime MUST reject that approval request
- **AND** the runtime MUST avoid mutating the session into build mode for that blocked decision

### Requirement: Runtime run results SHALL expose structured outputs needed for rich workbench messages
The runtime SHALL preserve structured terminal result metadata so that the workbench can distinguish protocol outputs, structured domain results, and structured runtime failures.

#### Scenario: Completed run returns protocol output distinctly
- **WHEN** a run completes with protocol output
- **THEN** the terminal run result MUST identify that output as protocol-capable rather than only plain text

#### Scenario: Completed run returns structured domain result distinctly
- **WHEN** a run completes with a structured domain result such as row preview data or an artifact reference
- **THEN** the terminal run result MUST identify that structured result distinctly from plain text
- **AND** the runtime MUST preserve the structured payload needed by the frontend to render a richer message surface

#### Scenario: Failed run returns structured runtime failure metadata
- **WHEN** a run terminates in error
- **THEN** the runtime MUST include structured runtime failure metadata in its terminal failure contract
- **AND** the client MUST be able to distinguish that structured failure context from a generic text-only error string
