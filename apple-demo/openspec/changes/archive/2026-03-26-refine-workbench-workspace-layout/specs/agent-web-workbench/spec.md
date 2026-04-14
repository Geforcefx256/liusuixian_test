## ADDED Requirements

### Requirement: Workbench SHALL allow user-resizable pane widths in the desktop shell
The authenticated workbench SHALL allow users to manually resize the session rail, conversation pane, workspace editor pane, and right workspace sidebar in desktop layouts while preserving minimum usable widths for each pane.

#### Scenario: User resizes the history rail
- **WHEN** the user drags the divider between the history rail and the main workbench content in a desktop layout
- **THEN** the workbench MUST resize the history rail width within governed minimum and maximum bounds
- **AND** the resize interaction MUST NOT cause a full-shell page scrollbar or collapse the main content unexpectedly

#### Scenario: User resizes the conversation and editor boundary
- **WHEN** the workbench is in the workspace-expanded state and the user drags the divider between the conversation pane and the workspace editor
- **THEN** the workbench MUST resize those panes within governed minimum widths
- **AND** the editor MUST remain the highest-priority pane once minimum widths are reached

#### Scenario: User resizes the editor and workspace sidebar boundary
- **WHEN** the workbench is in the workspace-expanded state and the user drags the divider between the workspace editor and the workspace sidebar
- **THEN** the sidebar width MUST update within governed minimum and maximum bounds
- **AND** the `工作空间` and `模板` tabs MUST remain readable without wrapping in supported desktop widths

#### Scenario: Constrained width still falls back safely
- **WHEN** the viewport becomes narrower than the governed minimum widths can satisfy simultaneously
- **THEN** the workbench MUST preserve editor usability before sacrificing the workspace sidebar
- **AND** the existing sidebar-yield or collapse behavior MAY still be used as the fallback response

## MODIFIED Requirements

### Requirement: Workbench SHALL provide a persistent workspace sidebar and a minimal workspace-open shell
The system SHALL treat the right-side work area as a persistent workspace sidebar for the current `user + agent` workspace and SHALL open a central file review-and-correction shell for supported files while keeping the conversation surface visible and conversation-led.

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

#### Scenario: User saves the current file in place
- **WHEN** the user edits a supported workspace file and saves from the expanded shell
- **THEN** the frontend MUST persist those changes as the new current content of that file
- **AND** the save flow MUST NOT require the user to create or choose an explicit versioned copy

#### Scenario: Workspace sidebar can be collapsed manually
- **WHEN** the user is in the workspace-expanded state
- **THEN** the workspace sidebar MUST remain visible by default
- **AND** the user MUST be able to collapse and later re-expand that sidebar without closing the active workspace file

#### Scenario: Workspace sidebar yields before the editor loses its primary editing width
- **WHEN** the workbench is in the workspace-expanded state and horizontal space becomes constrained
- **THEN** the right workspace sidebar MUST yield or collapse before the editor is forced to sacrifice its stable primary-toolbar layout
- **AND** the workbench MUST prioritize preserving usable editor width for the active file

#### Scenario: Switching sessions does not redefine workspace ownership
- **WHEN** the user selects a different session for the same active agent
- **THEN** the conversation surface MUST switch to the selected session history
- **AND** the workspace sidebar MUST continue to represent the same `user + agent` workspace unless the active agent changes

### Requirement: Workspace editor SHALL keep primary controls width-stable in the expanded shell
The workspace editor SHALL preserve a width-stable primary toolbar in the workspace-expanded shell so that the active document remains the highest-priority surface.

#### Scenario: Primary toolbar stays single-line during normal desktop workspace editing
- **WHEN** the workbench is in the workspace-expanded shell at normal desktop workspace widths
- **THEN** the editor MUST keep view switching, the MML parsing summary entry, save state, and save action on a single primary row
- **AND** the editor MUST NOT rely on toolbar wrapping or horizontal scrolling for those primary controls
- **AND** the primary row MUST NOT reserve space for a low-value shell-dismiss action such as `关闭工作区`

#### Scenario: Low-frequency editor controls do not compete with the primary row
- **WHEN** the editor needs to expose lower-frequency MML configuration details
- **THEN** those details MUST appear in a secondary disclosure area rather than as always-visible primary-toolbar form controls
- **AND** passive status text such as file-loaded state MUST NOT permanently occupy primary-toolbar space

#### Scenario: Closing the last open file exits the expanded shell
- **WHEN** the user closes the final open workspace file in the expanded shell
- **THEN** the workbench MUST exit the workspace-expanded state without requiring a separate dedicated `关闭工作区` action
- **AND** the conversation-first shell MUST remain visible as the base state
