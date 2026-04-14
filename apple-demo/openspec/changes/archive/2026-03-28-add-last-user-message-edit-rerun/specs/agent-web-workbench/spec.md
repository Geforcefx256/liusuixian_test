## ADDED Requirements

### Requirement: Workbench SHALL expose hover-only editing for the last real user message
The authenticated workbench SHALL allow editing only for the last real persisted user message shown as a normal user bubble in the active session, and it SHALL expose that edit affordance only while the pointer is over that bubble.

#### Scenario: Hovering the last editable user bubble reveals the edit affordance
- **WHEN** the active persisted session contains a last real user message and the workbench is idle
- **THEN** moving the pointer over that user bubble MUST reveal an `编辑` action for that bubble
- **AND** the workbench MUST NOT require a separate global edit toggle in order to reach that action

#### Scenario: Non-terminal or blocked states do not show edit affordance
- **WHEN** a user message is not the last real user message, or the session is currently running, or the session is blocked on a pending interaction
- **THEN** the conversation surface MUST NOT show the `编辑` action for that message
- **AND** the user MUST NOT be able to enter the message-edit rerun flow from that state

### Requirement: Workbench SHALL use the composer as the edit surface for last-user reruns
The authenticated workbench SHALL reuse the existing bottom composer as the editing surface for the last editable user message rather than turning the message bubble itself into an inline editor.

#### Scenario: Selecting edit prefills the composer with the last user message
- **WHEN** the user activates `编辑` on the last editable user bubble
- **THEN** the workbench MUST copy that persisted user text into the bottom composer
- **AND** the composer MUST enter a visible edit-rerun mode for that specific persisted message

#### Scenario: Edit-rerun submission requires explicit destructive confirmation
- **WHEN** the composer is in edit-rerun mode and the user attempts to submit the edited text
- **THEN** the workbench MUST request explicit confirmation before sending the rerun
- **AND** that confirmation MUST state that the old user message and all later conversation messages will be removed
- **AND** that confirmation MUST state that workspace files and prior tool side effects will not be reverted

#### Scenario: Confirmed edit-rerun keeps the same session and replaces the visible tail
- **WHEN** the user confirms an edit-rerun submission successfully
- **THEN** the workbench MUST keep the same persisted session selected
- **AND** the conversation history after reload or stream completion MUST show the replacement user message and the regenerated later conversation instead of the obsolete tail

#### Scenario: Canceled edit-rerun leaves the existing conversation untouched
- **WHEN** the user cancels the destructive confirmation for an edit-rerun
- **THEN** the workbench MUST keep the existing persisted conversation history unchanged
- **AND** the workbench MUST NOT issue the rerun request for that cancellation
