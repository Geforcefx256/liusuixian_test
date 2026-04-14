## MODIFIED Requirements

### Requirement: Workbench SHALL provide a persistent workspace sidebar and a minimal workspace-open shell
The system SHALL treat the right-side work area as a persistent workspace sidebar for the current `user + agent` workspace and SHALL open a central file review-and-correction shell for supported files while keeping the conversation surface visible and conversation-led, including runtime-written output files that join the same workspace, while distinguishing user-provided `input` materials from `working` files and folders that represent the active work directory. In the workspace-expanded state, the sidebar MUST support true manual collapse and explicit re-expansion without closing the active workspace file, and constrained-width behavior MUST preserve a usable sidebar header and predictable visibility controls.

#### Scenario: Workspace sidebar is visible during normal conversation
- **WHEN** the user is in the base workbench shell
- **THEN** the right side MUST show a workspace sidebar rather than status-summary cards
- **AND** that sidebar MUST expose peer tabs for `工作空间` and `模板`
- **AND** the workspace tab MUST NOT render a workspace-scoped upload entry point in the sidebar

#### Scenario: Workspace heading does not reuse session naming
- **WHEN** the user views the right-side workspace sidebar while switching between sessions for the same agent
- **THEN** the workspace root grouping MUST continue to represent the current `user + agent` workspace
- **AND** the sidebar MUST NOT present the selected session title as the workspace title
- **AND** the sidebar MUST NOT render redundant repeated headings such as an additional `工作区文件` headline or a repeated `小曼智能体工作区`-style title above the file tree

#### Scenario: Workspace groups use `input` and `working` labels
- **WHEN** the workbench renders grouped workspace content in the `工作空间` tab
- **THEN** uploaded user materials MUST appear under the user-facing group label `input`
- **AND** runtime-written or manually created workspace files and folders MUST appear under the user-facing group label `working`

#### Scenario: User opens a workspace file from the tree
- **WHEN** the user opens a workspace file from the right-side workspace sidebar tree
- **THEN** the frontend MUST enter a workspace-expanded state
- **AND** the layout MUST insert a central workspace area between the conversation surface and the workspace sidebar
- **AND** the workspace-expanded state MUST keep the conversation surface visible

#### Scenario: Workspace-open shell renders supported file content
- **WHEN** the user opens a supported workspace file in the expanded shell
- **THEN** the central workspace area MUST render the current file content instead of placeholder-only copy
- **AND** the shell MUST provide the file-specific review surface needed for supported plain-text files, Markdown files, CSV files, and `txt` files that are configured for MML parsing

#### Scenario: Input file opens as an editable workspace surface
- **WHEN** the user opens a workspace file sourced from the scoped `input` tree
- **THEN** the workbench MUST render that file content in the normal workspace shell
- **AND** the shell MUST allow editing and saving that file in place instead of presenting it as read-only

#### Scenario: User saves the current editable file in place
- **WHEN** the user edits an editable workspace file in either `input` or `working`
- **THEN** the frontend MUST persist those changes as the new current content of that same file
- **AND** the save flow MUST NOT require the user to create or choose an explicit versioned copy

#### Scenario: User manually collapses the sidebar in workspace-expanded state
- **WHEN** the user activates the explicit sidebar collapse control while a workspace file is open
- **THEN** the workbench MUST hide the sidebar from the active shell layout rather than only toggling internal state
- **AND** the workbench MUST keep the current workspace file open and active
- **AND** the workbench MUST expose an explicit affordance to re-expand the sidebar without leaving the current file

#### Scenario: User re-expands the sidebar after manual collapse
- **WHEN** the user activates the explicit sidebar re-expand control from a manually collapsed state
- **THEN** the workbench MUST restore the sidebar in the same workspace-expanded shell
- **AND** the workbench MUST keep the previously active workspace file open
- **AND** the workbench MUST preserve sidebar-local context such as expanded folders unless the user performed a separate reset action

#### Scenario: Constrained width auto-collapses sidebar by default
- **WHEN** the workbench body width becomes too narrow to satisfy the workspace-expanded minimum layout
- **THEN** the workbench MUST auto-collapse the sidebar by default
- **AND** the workbench MUST still expose an explicit re-expand affordance
- **AND** the auto-collapsed state MUST NOT close or blur the active workspace file

#### Scenario: User can temporarily reopen the sidebar while constrained width remains active
- **WHEN** constrained-width auto-collapse is active and the user explicitly re-expands the sidebar
- **THEN** the workbench MUST render the sidebar again without clearing the active workspace file
- **AND** the sidebar header MUST keep `工作空间` / `模板` and the collapse control usable within the constrained width
- **AND** a later user-initiated collapse MUST take effect immediately even if constrained-width auto-collapse is still active
