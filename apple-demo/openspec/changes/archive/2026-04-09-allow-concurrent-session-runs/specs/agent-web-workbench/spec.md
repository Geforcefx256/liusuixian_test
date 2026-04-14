## MODIFIED Requirements

### Requirement: Workbench SHALL manage draft conversations, persisted sessions, and history rail actions distinctly
The system SHALL distinguish a blank conversation draft from a persisted backend session and SHALL present session history in a collapsed-by-default rail with hover-triggered preview, explicit deletion behavior, and a scoped bulk-clear action that only affects deletable historical sessions for the active agent.

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
- **AND** a confirmed delete MUST remove the session from the visible history list

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

### Requirement: Workbench SHALL expose shared-workspace scope and lock reasons through hover/focus help
The workbench SHALL keep shared-workspace explanations lightweight by using hover/focus help on relevant surfaces instead of persistent instructional banners or toast-based explanations.

#### Scenario: Workspace area is labeled as shared
- **WHEN** the user views the workspace sidebar or workspace-open shell for the active agent
- **THEN** the user-visible workspace title MUST render as `共享工作区`
- **AND** the explanation that files, uploads, and generated outputs are shared across sessions for that agent MUST appear only through hover/focus help

#### Scenario: Locked send action explains the current session lock reason on hover or focus
- **WHEN** the send action is unavailable because the current session already has an active run or an unresolved pending question
- **THEN** the workbench MUST expose hover/focus help that explains the current session must finish or resolve that question before sending again
- **AND** the workbench MUST NOT rely on a transient toast as the primary explanation for that locked state

#### Scenario: Locked session delete explains active-session protection on hover or focus
- **WHEN** a session delete action is unavailable because that specific session still has an active run or an unresolved pending question
- **THEN** the workbench MUST expose hover/focus help that explains active sessions cannot be deleted until that work is resolved
- **AND** the locked action MUST remain visually unavailable even before the help is requested

#### Scenario: Unavailable bulk-clear action explains that no idle history is deletable
- **WHEN** the bulk-clear history action is unavailable because no historical session is currently deletable after excluding the current session and preserving active sessions
- **THEN** the workbench MUST expose hover/focus help that explains there is no idle history available to clear
- **AND** the workbench MUST NOT rely on a transient toast as the primary explanation for that unavailable state

## REMOVED Requirements

### Requirement: Workbench SHALL gate run creation by shared-workspace occupancy
**Reason**: Run creation is no longer governed by another session's shared-workspace occupancy. The user can start a run from a different session in the same shared workspace, so gating must be based on the current session's own activity state.
**Migration**: Replace workspace-global send blocking with session-local run and pending-question checks, and keep streaming/stop ownership attached to the originating session.

### Requirement: Workbench SHALL keep history-management actions aligned with shared-workspace execution ownership
**Reason**: History management is no longer globally locked by any active session in the shared workspace. Only the active session itself is protected from deletion, and bulk-clear skips active sessions.
**Migration**: Show per-session active indicators, disable delete only for the targeted active session, and keep bulk-clear available whenever at least one idle historical session remains deletable.

## ADDED Requirements

### Requirement: Workbench SHALL gate run creation by session activity state
The workbench SHALL determine sendability, stop control, and pending-question continuation by the currently selected session's own activity state rather than by another session's shared-workspace occupancy.

#### Scenario: Another session's active run does not block the current session from sending
- **WHEN** one session in the current shared workspace already has an active run or an unresolved pending question and the user switches to a different idle session
- **THEN** the workbench MUST allow the user to submit a new run from that different session
- **AND** the workbench MUST keep the shared workspace presentation unchanged while doing so

#### Scenario: New conversation can send even while another session is active
- **WHEN** the user creates a new conversation while another session in the same shared workspace is active
- **THEN** the workbench MUST enter the normal blank-draft conversation shell
- **AND** the workbench MUST allow the first prompt to create a backend session and start a run without waiting for the other session to finish

#### Scenario: Returning to an active session restores that session's stop affordance
- **WHEN** the user switches away from and later returns to a session that still owns an active run
- **THEN** the workbench MUST restore the stop affordance for that same session
- **AND** the workbench MUST NOT transfer stop control to a different session merely because it became the active view earlier

#### Scenario: Pending question blocks ordinary send only in the owning session
- **WHEN** the current session contains an unresolved pending question interaction
- **THEN** the workbench MUST prevent ordinary send for that same session
- **AND** the workbench MUST require the user to continue through the dedicated question reply or reject flow
- **AND** the workbench MUST NOT block ordinary send in a different idle session solely because of that pending question

### Requirement: Workbench SHALL keep history-management actions aligned with per-session activity state
The workbench SHALL reflect per-session activity in the history rail so users can locate active sessions, protect those sessions from deletion, and keep bulk-clear scoped to idle historical sessions.

#### Scenario: History rail identifies active sessions without assuming a single owner
- **WHEN** one or more sessions in the current shared workspace have an active run or an unresolved pending question
- **THEN** the history rail MUST identify each active session
- **AND** the user MUST be able to navigate back to any identified active session without losing its activity indicator

#### Scenario: Idle session delete remains available while another session is active
- **WHEN** one session in the current shared workspace is active and the user targets a different idle session for deletion
- **THEN** the workbench MUST keep delete available for that idle session
- **AND** the workbench MUST NOT disable that delete action solely because another session is active

#### Scenario: Active session delete remains unavailable
- **WHEN** the user targets a session that currently has an active run or an unresolved pending question for deletion
- **THEN** the workbench MUST render delete as unavailable for that session
- **AND** the workbench MUST NOT issue a delete request for that active session

#### Scenario: Bulk-clear history remains available while other sessions are active
- **WHEN** one or more sessions in the current shared workspace are active and at least one idle historical session remains deletable
- **THEN** the workbench MUST keep the bulk-clear history action available
- **AND** the workbench MUST scope the resulting clear operation to deletable idle historical sessions only
