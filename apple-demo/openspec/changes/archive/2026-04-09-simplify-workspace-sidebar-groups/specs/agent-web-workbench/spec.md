## MODIFIED Requirements

### Requirement: Workbench SHALL provide a persistent workspace sidebar and a minimal workspace-open shell
The system SHALL treat the right-side work area as a persistent workspace sidebar for the current `user + agent` workspace and SHALL open a central file review-and-correction shell for supported files while keeping the conversation surface visible and conversation-led, including runtime-written output files that join the same workspace. The workspace tab MUST distinguish uploaded user materials from active project files and folders while presenting those groups to the user as `upload` and `project`. In the workspace-expanded state, the sidebar MUST support true manual collapse and explicit re-expansion without closing the active workspace file, and constrained-width behavior MUST preserve a usable sidebar header and predictable visibility controls without requiring a separate persistent shared-workspace title row above the tree.

#### Scenario: Workspace sidebar is visible during normal conversation
- **WHEN** the user is in the base workbench shell
- **THEN** the right side MUST show a workspace sidebar rather than status-summary cards
- **AND** that sidebar MUST expose peer tabs for `工作空间` and `模板`
- **AND** the workspace tab MUST NOT render a workspace-scoped upload entry point in the sidebar

#### Scenario: Workspace grouping does not reuse session naming or require a separate title row
- **WHEN** the user views the right-side workspace sidebar while switching between sessions for the same agent
- **THEN** the workspace grouping MUST continue to represent the current `user + agent` workspace
- **AND** the sidebar MUST NOT present the selected session title as a workspace title
- **AND** the sidebar MUST NOT render a separate persistent title row such as `共享工作区` above the file tree

#### Scenario: Workspace groups use `upload` and `project` labels
- **WHEN** the workbench renders grouped workspace content in the `工作空间` tab
- **THEN** uploaded user materials MUST appear under the user-facing group label `upload`
- **AND** runtime-written or manually created workspace files and folders MUST appear under the user-facing group label `project`

#### Scenario: Workspace group headers use folder iconography
- **WHEN** the workbench renders the `upload` or `project` group header
- **THEN** the header MUST show a folder icon before the group label

#### Scenario: Empty workspace groups stay visually clean
- **WHEN** the workbench renders an empty `upload` or `project` group
- **THEN** the group header MUST remain visible
- **AND** the sidebar MUST NOT render a `0` count for that empty group
- **AND** the sidebar MUST NOT render a separate `暂无文件` row for that empty group

#### Scenario: User opens a workspace file from the tree
- **WHEN** the user opens a workspace file from the right-side workspace sidebar tree
- **THEN** the frontend MUST enter a workspace-expanded state
- **AND** the layout MUST insert a central workspace area between the conversation surface and the workspace sidebar
- **AND** the workspace-expanded state MUST keep the conversation surface visible

#### Scenario: Workspace-open shell renders supported file content
- **WHEN** the user opens a supported workspace file in the expanded shell
- **THEN** the central workspace area MUST render the current file content instead of placeholder-only copy
- **AND** the shell MUST provide the file-specific review surface needed for supported plain-text files, Markdown files, CSV files, and `txt` files that are configured for MML parsing

#### Scenario: Upload file opens as an editable workspace surface
- **WHEN** the user opens a workspace file sourced from the scoped `upload` tree
- **THEN** the workbench MUST render that file content in the normal workspace shell
- **AND** the shell MUST allow editing and saving that file in place instead of presenting it as read-only

#### Scenario: User saves the current editable file in place
- **WHEN** the user edits an editable workspace file in either `upload` or `project`
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

### Requirement: Workbench conversation composer SHALL use an upload-first file entry model
The authenticated workbench SHALL treat the conversation composer as the only upload entry surface for workspace materials rather than as a mixed upload-and-create area or a second workspace-management surface.

#### Scenario: Composer primary file action is a compact attachment trigger
- **WHEN** the user views the conversation composer in either the base shell or the workspace-expanded shell
- **THEN** the primary left-side file action MUST render as a compact `+` attachment trigger rather than a text button labeled `上传文件`
- **AND** activating that trigger MUST open the governed file picker immediately

#### Scenario: Composer file picker supports one selection with multiple files
- **WHEN** the user selects more than one supported file from the governed file picker opened by the `+` trigger
- **THEN** the workbench MUST submit all selected files through the normal workspace upload flow
- **AND** the composer MUST NOT require the user to reopen the picker separately for each file in that one selection

#### Scenario: Composer upload can preserve directory-backed input paths
- **WHEN** the user uploads files through the governed composer flow from a directory selection or another source that exposes relative paths
- **THEN** the workbench MUST preserve those relative paths into the resulting `input` workspace tree
- **AND** files inside uploaded folders MUST become openable from the `input` tree after the upload completes

#### Scenario: Manual creation stays outside the composer upload surface
- **WHEN** the user uses the authenticated workbench
- **THEN** the composer MUST NOT present blank-file creation actions
- **AND** the workbench MUST keep manual `+` creation actions confined to the `project` workspace area rather than merging them into the composer upload control

### Requirement: Workbench SHALL render hierarchical trees for `input` and `working`
The workbench SHALL render the underlying `input` and `working` workspace groups as hierarchical trees whenever their entries contain nested path segments or explicit folder nodes, while presenting those trees to the user as `upload` and `project`.

#### Scenario: Project files with nested paths render as a tree
- **WHEN** the `working` group contains paths such as `plans/v1.md` or `plans/mml/core/site.mml`
- **THEN** the sidebar MUST render nested folder nodes under the `project` group rather than flattening those paths into one text row
- **AND** each folder node MUST support expand and collapse behavior

#### Scenario: Upload files inside uploaded folders remain openable from the tree
- **WHEN** the `input` group contains files under nested uploaded folders
- **THEN** the sidebar MUST render those folders as expandable tree nodes under the `upload` group
- **AND** the user MUST be able to open a file from inside that folder hierarchy through the same workspace-open flow

#### Scenario: Folder rows do not pretend to be files
- **WHEN** the user views a folder node in the workspace tree
- **THEN** the sidebar MUST render that row as a folder-specific tree node rather than as a file row
- **AND** activating the folder row MUST expand or collapse the folder instead of opening an editor tab

### Requirement: Workbench SHALL expose a `NEW` action for `working`
The workbench SHALL expose a dedicated compact `+` action inside the workspace sidebar for creating new `working` entries without reusing the composer upload surface.

#### Scenario: Compact `+` is available only for project content
- **WHEN** the user views the workspace sidebar
- **THEN** the sidebar MUST expose a compact `+` action for the `project` area
- **AND** the workbench MUST NOT expose that manual creation action for `upload`

#### Scenario: Compact `+` can create project folders and supported blank files
- **WHEN** the user opens the `+` action menu for the `project` area
- **THEN** the menu MUST expose `新建文件夹`、`新建 TXT`、`新建 MD`、`新建 MML`
- **AND** selecting one of those actions MUST create the corresponding entry under `working`

#### Scenario: Compact `+` uses the current project directory context
- **WHEN** the user triggers the top-level `+` while a `working` folder or file is selected
- **THEN** the created entry MUST default to the `working` root rather than inheriting the selected folder context

#### Scenario: Folder-level `+` uses that folder as create context
- **WHEN** the user triggers the row-level `+` for a `working` folder
- **THEN** the created entry MUST default to that folder context

### Requirement: Workbench SHALL expose shared-workspace scope and lock reasons through hover/focus help
The workbench SHALL keep shared-workspace explanations lightweight by omitting a persistent shared-workspace title row and limiting any remaining shared-scope explanation to hover/focus help on relevant surfaces, while continuing to expose lock reasons through hover/focus help instead of persistent instructional banners or toast-based explanations.

#### Scenario: Workspace area omits a persistent shared title row
- **WHEN** the user views the workspace sidebar or workspace-open shell for the active agent
- **THEN** the workspace tree MUST NOT render a separate persistent title row such as `共享工作区`
- **AND** any shared-workspace explanation that remains available MUST appear only through hover/focus help rather than persistent copy

#### Scenario: Locked send action explains the current session lock reason on hover or focus
- **WHEN** the send action is unavailable because the current session already has an active run or an unresolved pending question
- **THEN** the workbench MUST expose hover/focus help that explains the current session must finish or resolve that question before sending again
- **AND** the workbench MUST NOT rely on a transient toast as the primary explanation for that locked state

#### Scenario: Locked session delete explains active-session protection on hover or focus
- **WHEN** a session delete action is unavailable because that specific session still has an active run or an unresolved pending question
- **THEN** the workbench MUST expose hover/focus help that explains active sessions cannot be deleted until that work is resolved
- **AND** the locked action MUST remain visually unavailable even before the help is requested

#### Scenario: Unavailable bulk-clear action explains that no idle history is deletable
- **WHEN** the bulk-clear history action is unavailable because no historical session is currently deletable after excluding the current session and preserving active sessions
- **THEN** the workbench MUST expose hover/focus help that explains there is no idle history available to clear
- **AND** the workbench MUST NOT rely on a transient toast as the primary explanation for that unavailable state

### Requirement: Workbench working-group `NEW` menu SHALL support explicit dismiss interactions
The workbench SHALL allow users to dismiss the working-group `+` creation menu through standard pointer and keyboard interactions, and MUST NOT require a second click on the same trigger as the only closing path.

#### Scenario: Outside pointer interaction closes the opened `+` menu
- **WHEN** the user opens the working-group `+` menu in the workspace sidebar
- **AND** the user performs a primary pointer interaction outside the `+` trigger and dropdown region
- **THEN** the workbench MUST close the `+` menu

#### Scenario: Escape key closes the opened `+` menu
- **WHEN** the user opens the working-group `+` menu in the workspace sidebar
- **AND** keyboard focus remains within the workbench document
- **AND** the user presses `Escape`
- **THEN** the workbench MUST close the `+` menu

#### Scenario: Trigger toggle behavior remains available
- **WHEN** the user opens the working-group `+` menu and clicks the same `+` trigger again
- **THEN** the workbench MUST close the `+` menu

#### Scenario: Choosing a creation action closes the menu before inline creation state
- **WHEN** the user opens the working-group `+` menu and selects a creation action
- **THEN** the workbench MUST close the dropdown menu
- **AND** the workbench MUST enter the corresponding inline creation input state
