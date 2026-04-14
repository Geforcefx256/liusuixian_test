## ADDED Requirements

### Requirement: Workbench SHALL support explicit workspace file deletion from the sidebar
The workbench SHALL let users explicitly delete workspace files from the right-side workspace sidebar, including uploaded inputs and `output` files, while preserving the existing file-row selection and open interactions.

#### Scenario: Sidebar file row exposes a dedicated delete action
- **WHEN** the user views a file entry in the `工作空间` sidebar tree
- **THEN** that file row MUST expose a dedicated delete action separate from the main row click area
- **AND** using the delete action MUST NOT also trigger file selection or file opening

#### Scenario: Deleting from the sidebar preserves row selection and open semantics
- **WHEN** the user clicks the main file row area
- **THEN** the workbench MUST keep the existing single-click selection behavior
- **AND** double-clicking the main row area MUST continue to open that file in the workspace editor

### Requirement: Workbench SHALL require explicit high-risk confirmation before deleting a workspace file
Before issuing a workspace file delete request, the workbench SHALL require explicit confirmation and SHALL clearly warn that deletion is irreversible and may break current or later workbench execution.

#### Scenario: Delete confirmation warns about irreversible removal and execution risk
- **WHEN** the user triggers delete for any workspace file
- **THEN** the workbench MUST show a confirmation prompt before issuing the delete request
- **AND** that prompt MUST state that deletion cannot be undone
- **AND** that prompt MUST warn that deleting the file may affect the current session or later execution

#### Scenario: Delete confirmation highlights unsaved local changes
- **WHEN** the user triggers delete for a workspace file that currently has unsaved local edits in the editor
- **THEN** the confirmation prompt MUST additionally warn that unsaved changes will be lost if deletion continues

#### Scenario: User may continue deleting a high-risk file
- **WHEN** the file belongs to `output`, is the currently active file, or the current session is running
- **THEN** the workbench MUST still allow the user to confirm deletion
- **AND** the workbench MUST NOT silently block the delete solely because of that risk state

### Requirement: Workbench SHALL reconcile sidebar and editor state after a workspace file is deleted
After a confirmed workspace file deletion succeeds, the workbench SHALL refresh its workspace metadata and reconcile any now-invalid sidebar or editor state.

#### Scenario: Deleted file disappears from the sidebar and open-file state
- **WHEN** a workspace file delete request succeeds
- **THEN** the deleted file MUST be removed from the visible workspace sidebar
- **AND** the workbench MUST remove that file from any open editor tab state

#### Scenario: Deleting the active file reconciles the expanded editor shell
- **WHEN** the deleted file is the currently active workspace editor file
- **THEN** the workbench MUST switch to another remaining open file if one exists
- **AND** the workbench MUST exit the workspace-expanded state if no open files remain

#### Scenario: Delete failure remains visible to the user
- **WHEN** the delete request fails
- **THEN** the workbench MUST preserve the existing file state in the sidebar and editor
- **AND** the workbench MUST surface the failure to the user instead of silently hiding it
