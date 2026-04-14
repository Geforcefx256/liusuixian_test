## MODIFIED Requirements

### Requirement: Workbench SHALL provide a persistent workspace sidebar and a minimal workspace-open shell
The system SHALL treat the right-side work area as a persistent workspace sidebar for the current `user + agent` workspace and SHALL open a central file review-and-correction shell for supported files while keeping the conversation surface visible and conversation-led, including runtime-written output files that join the same workspace.

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

#### Scenario: Runtime-written output appears in the sidebar without auto-opening the editor
- **WHEN** a completed run returns a successful write result for a workspace output file
- **THEN** the workbench MUST refresh or reconcile the workspace sidebar so that file becomes available under the output group with its full relative path label
- **AND** the workbench MUST NOT enter the workspace-expanded editor state solely because the file was written

### Requirement: Workbench SHALL use the active workspace file as the primary follow-up file context
The workbench SHALL distinguish the active workspace file from the broader workspace file set and SHALL use that active file as the primary file context for follow-up Agent actions initiated from the workspace flow while still allowing runtime-written workspace files to join the broader follow-up file context automatically.

#### Scenario: Opening or switching tabs changes the active workspace file
- **WHEN** the user opens a workspace file or switches to another open file tab
- **THEN** the workbench MUST update the active workspace file to match the visible current file
- **AND** follow-up workspace actions MUST target that active file

#### Scenario: Continue-processing action prefers the active workspace file
- **WHEN** the user triggers the workspace action to continue Agent processing for the current file
- **THEN** the frontend MUST submit the active workspace file as the primary file context for that follow-up action
- **AND** the broader workspace file list MAY remain available only as supplementary context

#### Scenario: Newly written workspace output becomes supplementary context automatically
- **WHEN** a successful run adds or overwrites a workspace output file and the user later starts another run for the same active agent
- **THEN** the frontend MUST include that workspace file in `invocationContext.fileAssets` without requiring manual checkbox selection
- **AND** that file MUST NOT become `invocationContext.activeFile` unless the user explicitly opens or selects it
