## MODIFIED Requirements

### Requirement: Workbench SHALL provide a persistent workspace sidebar and a minimal workspace-open shell
The system SHALL treat the right-side work area as a persistent workspace sidebar for the current `user + agent` workspace and SHALL open a central file review-and-correction shell for supported files while keeping the conversation surface visible and conversation-led.

#### Scenario: Workspace sidebar is visible during normal conversation
- **WHEN** the user is in the base workbench shell
- **THEN** the right side MUST show a workspace sidebar rather than status-summary cards
- **AND** that sidebar MUST expose workspace entry points such as file groups, file items, upload controls, or template entry points

#### Scenario: Workspace heading does not reuse session naming
- **WHEN** the user views the right-side workspace sidebar while switching between sessions for the same agent
- **THEN** the workspace heading and root grouping MUST continue to represent the current `user + agent` workspace
- **AND** the sidebar MUST NOT present the selected session title as the workspace title

#### Scenario: User opens a workspace file from the sidebar
- **WHEN** the user opens a workspace file from the right-side workspace sidebar
- **THEN** the frontend MUST enter a workspace-expanded state
- **AND** the layout MUST insert a central workspace area between the conversation surface and the workspace sidebar
- **AND** the workspace-expanded state MUST keep the conversation surface visible

#### Scenario: Workspace-open shell renders supported file content
- **WHEN** the user opens a supported workspace file in the expanded shell
- **THEN** the central workspace area MUST render the current file content instead of placeholder-only copy
- **AND** the shell MUST provide the file-specific review surface needed for supported `txt`, `csv`, and recognized MML text files

#### Scenario: User saves the current file in place
- **WHEN** the user edits a supported workspace file and saves from the expanded shell
- **THEN** the frontend MUST persist those changes as the new current content of that file
- **AND** the save flow MUST NOT require the user to create or choose an explicit versioned copy

#### Scenario: Workspace sidebar can be collapsed manually
- **WHEN** the user is in the workspace-expanded state
- **THEN** the workspace sidebar MUST remain visible by default
- **AND** the user MUST be able to collapse and later re-expand that sidebar without closing the active workspace file

#### Scenario: Switching sessions does not redefine workspace ownership
- **WHEN** the user selects a different session for the same active agent
- **THEN** the conversation surface MUST switch to the selected session history
- **AND** the workspace sidebar MUST continue to represent the same `user + agent` workspace unless the active agent changes

## ADDED Requirements

### Requirement: Workbench SHALL allow artifact result cards to open referenced workspace files
The workbench SHALL allow structured artifact results in the conversation stream to act as direct entry points into the workspace editor for the referenced file.

#### Scenario: Artifact result opens the referenced file in the workspace shell
- **WHEN** the active conversation contains an artifact reference result that points to a workspace file
- **THEN** the result card MUST offer a direct open-file action
- **AND** invoking that action MUST open the referenced file in the workspace-expanded shell and make it the active workspace file

#### Scenario: Missing artifact reference fails safely
- **WHEN** the user invokes the open-file action for an artifact reference whose workspace file can no longer be resolved
- **THEN** the workbench MUST show explicit feedback that the file is unavailable
- **AND** the conversation stream MUST remain usable

### Requirement: Workbench SHALL use the active workspace file as the primary follow-up file context
The workbench SHALL distinguish the active workspace file from the broader workspace file set and SHALL use that active file as the primary file context for follow-up Agent actions initiated from the workspace flow.

#### Scenario: Opening or switching tabs changes the active workspace file
- **WHEN** the user opens a workspace file or switches to another open file tab
- **THEN** the workbench MUST update the active workspace file to match the visible current file
- **AND** follow-up workspace actions MUST target that active file

#### Scenario: Continue-processing action prefers the active workspace file
- **WHEN** the user triggers the workspace action to continue Agent processing for the current file
- **THEN** the frontend MUST submit the active workspace file as the primary file context for that follow-up action
- **AND** the broader workspace file list MAY remain available only as supplementary context

### Requirement: Workbench SHALL recognize MML header metadata in supported text files
The workbench SHALL treat text files with a standard leading MML header comment as MML files and SHALL project that header into structured workspace toolbar controls.

#### Scenario: Standard MML header enables toolbar metadata controls
- **WHEN** a supported text file opens with a leading header comment of the form `/* ME TYPE=<type>, Version=<version> */`
- **THEN** the workbench MUST identify that file as MML in the workspace shell
- **AND** the toolbar MUST show `网元类型` and `网元版本` fields populated from the parsed header values

#### Scenario: Saving MML metadata writes the toolbar values back to the header
- **WHEN** the user changes `网元类型` or `网元版本` for an opened MML file and then saves the file
- **THEN** the workbench MUST persist those values back into the file's leading MML header comment
- **AND** the saved file content MUST remain the authority for future MML toolbar rendering
