## MODIFIED Requirements

### Requirement: Workbench SHALL manage draft conversations, persisted sessions, and history rail actions distinctly
The system SHALL distinguish a blank conversation draft from a persisted backend session and SHALL present session history in a collapsed-by-default rail with hover-triggered preview and deletion behavior.

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
