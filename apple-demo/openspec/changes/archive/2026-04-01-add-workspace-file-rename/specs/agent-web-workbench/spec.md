## ADDED Requirements

### Requirement: Workbench SHALL support explicit workspace file rename from the row action menu
The workbench SHALL let users explicitly rename workspace files from the right-side workspace sidebar row action menu while preserving the existing file-row selection and open interactions.

#### Scenario: Row action menu exposes rename alongside existing secondary actions
- **WHEN** the user opens the secondary action menu for a workspace file in the `工作空间` sidebar tree
- **THEN** the menu MUST expose a `重命名` action in addition to the existing secondary file actions
- **AND** using the secondary action menu MUST NOT also trigger file selection or file opening

#### Scenario: Rename prompt accepts basename only
- **WHEN** the user triggers workspace file rename from the row action menu
- **THEN** the workbench MUST collect a new basename for that file rather than a directory path
- **AND** the frontend MUST NOT offer UI affordances for changing the parent directory or extension as part of v1 rename

### Requirement: Workbench SHALL block destructive workspace file actions for running or dirty files
The workbench SHALL prevent delete and rename requests from being issued when the current session is running or when the targeted workspace file has unsaved local edits.

#### Scenario: Running session blocks destructive workspace file actions
- **WHEN** the current session has an active run in progress
- **THEN** the workbench MUST prevent workspace file delete and rename requests from being issued
- **AND** the user MUST NOT be able to continue through a confirmation flow that bypasses that running-state block

#### Scenario: Dirty file blocks destructive actions for that file
- **WHEN** a workspace file currently has unsaved local edits in the editor
- **THEN** the workbench MUST prevent delete and rename requests for that file from being issued
- **AND** the workbench MUST preserve the current editor state instead of discarding those unsaved edits

### Requirement: Workbench SHALL reconcile sidebar and editor metadata after a successful rename
After a workspace file rename succeeds, the workbench SHALL refresh workspace metadata and update the affected open editor state without replacing the file's stable identity.

#### Scenario: Successful rename updates sidebar and active editor metadata in place
- **WHEN** a workspace file rename request succeeds
- **THEN** the renamed file MUST appear in the workspace sidebar under its new file name and path
- **AND** any open editor tab for that same file MUST keep its stable file identity while updating its visible file name and path

#### Scenario: Rename does not discard the current editable buffer
- **WHEN** a writable workspace file is open in the editor and the rename succeeds
- **THEN** the workbench MUST preserve that file's current editor buffer and local save state
- **AND** the rename flow MUST NOT simulate the change by deleting and re-creating a different frontend file identity

#### Scenario: Rename failure preserves the current workspace view state
- **WHEN** the workspace file rename request fails
- **THEN** the workbench MUST preserve the existing sidebar, tab, and editor state for that file
- **AND** the workbench MUST surface the failure to the user instead of silently mutating local file metadata
