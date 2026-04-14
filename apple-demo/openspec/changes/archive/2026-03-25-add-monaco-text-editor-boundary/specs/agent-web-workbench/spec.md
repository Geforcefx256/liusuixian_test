## ADDED Requirements

### Requirement: Workbench SHALL use Monaco as the text editing engine for text-class workspace files
The workbench SHALL use Monaco as the editing engine for supported text-class workspace files while preserving CSV as a separate table-oriented editing path.

#### Scenario: Plain text file opens in a Monaco-backed text view
- **WHEN** the user opens a supported plain text workspace file in the expanded workspace shell
- **THEN** the text view MUST render through a Monaco-backed editor surface
- **AND** the workbench MUST keep the surrounding workspace shell actions for tabs, save, and continue processing outside the editor engine

#### Scenario: MML file text view opens in the same Monaco-backed editor path
- **WHEN** the user opens an MML-capable workspace file in text view
- **THEN** the workbench MUST render the file's raw text through the same Monaco-backed text editor path used for plain text files
- **AND** the workbench MUST NOT require a separate MML-only editor engine for this change

#### Scenario: CSV remains on the table-oriented editing path
- **WHEN** the user opens a CSV workspace file
- **THEN** the workbench MUST continue to use the table-oriented CSV view rather than routing that file through Monaco as the primary editing surface

### Requirement: Workbench SHALL keep MML toolbar metadata controls outside the text editor engine
The workbench SHALL treat MML toolbar metadata controls as shell-owned structured projections of the leading header comment rather than as Monaco-owned business state.

#### Scenario: MML toolbar renders outside the text editor engine
- **WHEN** the active workspace file is recognized as MML
- **THEN** the workbench MUST render `网元类型` and `网元版本` as workspace toolbar controls outside the text editor engine
- **AND** those controls MUST remain available without requiring Monaco-specific UI widgets or inline editor decorations

#### Scenario: Editing toolbar metadata does not require immediate text rewriting
- **WHEN** the user changes `网元类型` or `网元版本` from the workspace toolbar
- **THEN** the workbench MUST mark the file as dirty and preserve those metadata edits for save
- **AND** the workbench MUST NOT require the raw text view to be rewritten immediately during that toolbar interaction

#### Scenario: Editing the leading MML header refreshes toolbar metadata
- **WHEN** the user edits the leading MML header directly in the text editor
- **THEN** the workbench MUST be able to refresh the visible `网元类型` and `网元版本` toolbar values from the edited text
- **AND** the saved file content MUST remain the authority for later toolbar rendering

### Requirement: Workbench SHALL preserve store-centered file authority across Monaco-backed text editing
The workbench SHALL keep workspace file content, metadata, dirty state, and follow-up execution context authoritative in workbench state rather than in Monaco editor instance state.

#### Scenario: Save uses workbench file state rather than reading business state from Monaco directly
- **WHEN** the user saves an opened text-class workspace file
- **THEN** the workbench MUST use the current workspace file state for the save operation
- **AND** the system MUST NOT require save behavior to depend on Monaco editor instance state as the business source of truth

#### Scenario: Continue-processing uses the current workspace file state after Monaco editing
- **WHEN** the user triggers continue processing for an active text-class workspace file after editing in Monaco
- **THEN** the workbench MUST use the current workspace file state as the source for any required save-before-run behavior
- **AND** the active file sent into the follow-up Agent flow MUST reflect the latest saved workspace file state rather than editor-local transient state
