## ADDED Requirements

### Requirement: Workbench SHALL refresh open non-dirty workspace files after successful tool-driven runs
The workbench SHALL reload editor content for currently open workspace files after a successful run changes workspace files, provided those files do not contain unsaved local edits. Users MUST NOT need to reload the entire page to see updated content for open non-dirty files.

#### Scenario: Active open file shows refreshed content after successful run
- **WHEN** a workspace file is already open in the editor, the file has no unsaved local edits, and a successful run changes that file in the workspace
- **THEN** the workbench MUST fetch the file's latest content after session/workspace reload completes
- **AND** the active editor view MUST show the refreshed content without requiring the user to manually close the tab or reload the page

#### Scenario: Inactive open tab is refreshed while remaining open
- **WHEN** multiple workspace files are open, one of the inactive open tabs has no unsaved local edits, and a successful run changes that file in the workspace
- **THEN** the workbench MUST refresh that file's cached editor content during post-run reconciliation
- **AND** returning to that tab later MUST show the latest content without requiring another backend file-open request triggered by a full page reload

#### Scenario: Dirty open file is not overwritten by automatic refresh
- **WHEN** a workspace file is open with unsaved local edits and a successful run changes the corresponding workspace file on disk
- **THEN** the workbench MUST NOT replace the dirty editor content during automatic post-run reconciliation
- **AND** the user's local unsaved content MUST remain visible until the user explicitly saves or discards it
