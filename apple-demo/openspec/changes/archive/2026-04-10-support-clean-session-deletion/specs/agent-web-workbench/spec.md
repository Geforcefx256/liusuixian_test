## MODIFIED Requirements

### Requirement: Workbench SHALL manage draft conversations, persisted sessions, and history rail actions distinctly
The system SHALL distinguish a blank conversation draft from a persisted backend session and SHALL present session history in a collapsed-by-default rail with hover-triggered preview, explicit deletion behavior for idle and active sessions, and a scoped bulk-clear action that only affects deletable historical sessions for the active agent.

#### Scenario: New conversation returns to a blank conversation shell
- **WHEN** the user triggers the new-conversation action from the history rail
- **THEN** the frontend MUST clear the currently selected persisted session from the UI
- **AND** the workbench MUST return to an empty conversation state inside the standard workbench shell
- **AND** the frontend MUST NOT create a backend session until the user sends the first prompt for that draft

#### Scenario: First prompt creates the persisted session
- **WHEN** the user sends the first prompt from a blank conversation state
- **THEN** the frontend MUST create a backend session for the selected agent before streaming the run
- **AND** the new session MUST appear in the history rail after creation

#### Scenario: Hovering the left rail opens the preview-rich history overlay
- **WHEN** the user moves the pointer into the collapsed left history rail region
- **THEN** the workbench MUST open the expanded history surface without requiring an explicit click on a dedicated history toggle
- **AND** the expanded surface MUST show searchable session entries with title, updated time, and a one-line preview string
- **AND** the expanded session surface MUST open without changing the in-flow width of the main workbench layout

#### Scenario: Leaving the history hover zone closes the expanded surface
- **WHEN** the user leaves both the collapsed history rail region and the expanded history surface
- **THEN** the workbench MUST close the expanded history surface
- **AND** moving the pointer from the collapsed rail into the expanded surface MUST NOT prematurely close that surface

#### Scenario: Session deletion requires confirmation
- **WHEN** the user chooses to delete a session from the expanded history rail
- **THEN** the frontend MUST request explicit confirmation before issuing the delete
- **AND** a confirmed delete MUST remove the session from the visible history list regardless of whether that session was idle, running, stop-pending, or awaiting a question response

#### Scenario: Deleting the active session returns the workbench to a blank shell immediately
- **WHEN** the user confirms deletion for the session that is currently selected in the workbench
- **THEN** the frontend MUST immediately clear that session from the current view
- **AND** the workbench MUST return to an empty conversation state inside the standard workbench shell
- **AND** the right-side shared workspace sidebar MUST remain available

#### Scenario: Deleted session ignores stale stream and reload callbacks
- **WHEN** the frontend receives a late stream event, hydration result, interaction reload, or session-list refresh for a session that the user has already deleted locally
- **THEN** the workbench MUST ignore that stale callback for the deleted session
- **AND** the frontend MUST NOT recreate local session state or reinsert that deleted session into the visible history list from that callback

#### Scenario: History overlay exposes a bulk-clear action for deletable historical sessions only
- **WHEN** the user opens the expanded history rail while an active session is selected and at least one other persisted idle session exists for the same active agent
- **THEN** the history overlay MUST expose a secondary bulk-clear action for history management
- **AND** that action MUST be presented separately from the primary new-conversation control
- **AND** the frontend MUST describe that the current session will not be cleared
- **AND** the frontend MUST describe that other active historical sessions will be preserved

#### Scenario: Bulk-clear confirmation states scope and preservation
- **WHEN** the user triggers the bulk-clear history action
- **THEN** the frontend MUST request explicit confirmation before issuing the clear request
- **AND** the confirmation content MUST state that only deletable historical sessions for the active agent will be deleted
- **AND** the confirmation content MUST state that the current session will not be affected
- **AND** the confirmation content MUST state that other active sessions will be preserved

#### Scenario: Bulk-clear action is unavailable when no deletable historical sessions exist
- **WHEN** the active agent has no persisted idle sessions other than the current session, or has no persisted sessions at all
- **THEN** the history overlay MUST render the bulk-clear history action as unavailable
- **AND** the workbench MUST NOT issue a bulk-clear request from that unavailable state

#### Scenario: Bulk-clear remains available while the current session is active
- **WHEN** the current session has an active run or an unresolved pending question and at least one other persisted idle session exists for the same active agent
- **THEN** the history overlay MUST keep the bulk-clear history action available
- **AND** the workbench MUST communicate that the current session and any other active sessions will be preserved

#### Scenario: Confirmed bulk clear keeps the current session selected
- **WHEN** the user confirms bulk clearing history for the active agent while a current session is selected
- **THEN** the workbench MUST remove every deleted historical session for that active agent from the visible history list
- **AND** the workbench MUST keep the current session selected and its conversation state visible
- **AND** the workbench MUST keep any skipped active historical session visible
- **AND** the workbench MUST provide a lightweight success acknowledgment after the clear completes
