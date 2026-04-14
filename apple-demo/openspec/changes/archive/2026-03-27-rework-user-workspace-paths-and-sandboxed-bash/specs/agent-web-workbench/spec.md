## ADDED Requirements

### Requirement: Workbench SHALL confirm before replacing an uploaded workspace file
The authenticated workbench SHALL require explicit user confirmation before replacing an existing uploaded file whose scoped workspace upload path collides with a newly selected local file.

#### Scenario: Same-name upload prompts the user before replacement
- **WHEN** the user selects a local file whose target scoped `uploads/` path already exists in the current `user + agent` workspace
- **THEN** the workbench MUST present an explicit confirmation step before continuing the upload
- **AND** the confirmation MUST identify that the existing uploaded file will be replaced

#### Scenario: Cancelling replacement keeps the existing uploaded file unchanged
- **WHEN** the user dismisses or rejects that overwrite confirmation
- **THEN** the workbench MUST cancel the replacement upload
- **AND** the existing uploaded workspace entry MUST remain available unchanged

#### Scenario: Confirmed replacement refreshes the existing uploaded entry
- **WHEN** the user confirms replacement for the colliding upload path
- **THEN** the workbench MUST retry the upload with explicit overwrite intent
- **AND** the refreshed workspace entry MUST continue to use the same visible upload path after replacement

## MODIFIED Requirements

### Requirement: Workbench SHALL provide a persistent workspace sidebar and a minimal workspace-open shell
The system SHALL treat the right-side work area as a persistent workspace sidebar for the current `user + agent` workspace and SHALL open a central file review-and-correction shell for supported files while keeping the conversation surface visible and conversation-led, including runtime-written output files that join the same workspace, while distinguishing read-only uploaded inputs from writable workspace files.

#### Scenario: Workspace sidebar is visible during normal conversation
- **WHEN** the user is in the base workbench shell
- **THEN** the right side MUST show a workspace sidebar rather than status-summary cards
- **AND** that sidebar MUST expose peer tabs for `工作空间` and `模板`
- **AND** the workspace tab MUST expose workspace entry points such as a unified `新增` trigger, file groups, and file items

#### Scenario: Workspace heading does not reuse session naming
- **WHEN** the user views the right-side workspace sidebar while switching between sessions for the same agent
- **THEN** the workspace root grouping MUST continue to represent the current `user + agent` workspace
- **AND** the sidebar MUST NOT present the selected session title as the workspace title
- **AND** the sidebar MUST NOT render redundant repeated headings such as an additional `工作区文件` headline or a repeated `小曼智能体工作区`-style title above the file tree

#### Scenario: Workspace add menu includes upload and governed blank-file creation
- **WHEN** the user opens the primary workspace entry menu from the `工作空间` tab
- **THEN** the workbench MUST present `上传文件`, `新建 TXT`, `新建 MD`, and `新建 MML` as distinct actions
- **AND** choosing a create action MUST produce a new workspace file within the current `user + agent` workspace rather than pretending to upload a file

#### Scenario: User opens a workspace file from the sidebar
- **WHEN** the user opens a workspace file from the right-side workspace sidebar
- **THEN** the frontend MUST enter a workspace-expanded state
- **AND** the layout MUST insert a central workspace area between the conversation surface and the workspace sidebar
- **AND** the workspace-expanded state MUST keep the conversation surface visible

#### Scenario: Workspace-open shell renders supported file content
- **WHEN** the user opens a supported workspace file in the expanded shell
- **THEN** the central workspace area MUST render the current file content instead of placeholder-only copy
- **AND** the shell MUST provide the file-specific review surface needed for supported plain-text files, Markdown files, CSV files, and `txt` files that are configured for MML parsing

#### Scenario: Uploaded file opens as a read-only review surface
- **WHEN** the user opens a workspace file sourced from the scoped `uploads/` root
- **THEN** the workbench MUST render that file content in the normal workspace shell
- **AND** the shell MUST clearly present that file as read-only and disable save actions for that file

#### Scenario: User saves the current writable file in place
- **WHEN** the user edits a writable workspace file and saves from the expanded shell
- **THEN** the frontend MUST persist those changes as the new current content of that file
- **AND** the save flow MUST NOT require the user to create or choose an explicit versioned copy

#### Scenario: Workspace sidebar can be collapsed manually
- **WHEN** the user is in the workspace-expanded state
- **THEN** the workspace sidebar MUST remain visible by default
- **AND** the user MUST be able to collapse and later re-expand that sidebar without closing the active workspace file

### Requirement: Workbench SHALL use the active workspace file as the primary follow-up file context
The workbench SHALL distinguish the active workspace file from the broader workspace file set and SHALL use that active file's workspace-relative path as the primary file context for follow-up Agent actions initiated from the workspace flow while relying on runtime file-discovery tools rather than auto-injecting the broader workspace file set by default.

#### Scenario: Opening or switching tabs changes the active workspace file
- **WHEN** the user opens a workspace file or switches to another open file tab
- **THEN** the workbench MUST update the active workspace file to match the visible current file
- **AND** follow-up workspace actions MUST target that active file

#### Scenario: Continue-processing action prefers the active workspace file path
- **WHEN** the user triggers the workspace action to continue Agent processing for the current file
- **THEN** the frontend MUST submit that active workspace file's workspace-relative path as the primary file context for that follow-up action
- **AND** the follow-up request MUST NOT require opaque `fileKey` syntax as the model-facing file contract

#### Scenario: Newly written workspace output remains discoverable but is not auto-submitted
- **WHEN** a successful run adds or overwrites a workspace output file and the user later starts another run for the same active agent
- **THEN** the workbench MUST keep that file available in the workspace sidebar for explicit opening or later discovery
- **AND** the frontend MUST NOT auto-submit that broader workspace file set as supplementary file context unless the user explicitly selects a file for that run
