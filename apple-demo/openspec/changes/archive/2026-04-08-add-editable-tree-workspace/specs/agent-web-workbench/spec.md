## MODIFIED Requirements

### Requirement: Workbench SHALL provide a persistent workspace sidebar and a minimal workspace-open shell
The system SHALL treat the right-side work area as a persistent workspace sidebar for the current `user + agent` workspace and SHALL open a central file review-and-correction shell for supported files while keeping the conversation surface visible and conversation-led, including runtime-written output files that join the same workspace, while distinguishing user-provided `input` materials from `working` files and folders that represent the active work directory.

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

#### Scenario: Workspace sidebar can be collapsed manually
- **WHEN** the user is in the workspace-expanded state
- **THEN** the workspace sidebar MUST remain visible by default
- **AND** the user MUST be able to collapse and later re-expand that sidebar without closing the active workspace file

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
- **AND** the workbench MUST keep manual `NEW` actions confined to the `working` workspace area rather than merging them into the `+` upload control

## ADDED Requirements

### Requirement: Workbench SHALL render hierarchical trees for `input` and `working`
The workbench SHALL render the `input` and `working` workspace groups as hierarchical trees whenever their entries contain nested path segments or explicit folder nodes.

#### Scenario: Working files with nested paths render as a tree
- **WHEN** the `working` group contains paths such as `plans/v1.md` or `plans/mml/core/site.mml`
- **THEN** the sidebar MUST render nested folder nodes rather than flattening those paths into one text row
- **AND** each folder node MUST support expand and collapse behavior

#### Scenario: Input files inside uploaded folders remain openable from the tree
- **WHEN** the `input` group contains files under nested uploaded folders
- **THEN** the sidebar MUST render those folders as expandable tree nodes
- **AND** the user MUST be able to open a file from inside that folder hierarchy through the same workspace-open flow

#### Scenario: Folder rows do not pretend to be files
- **WHEN** the user views a folder node in the workspace tree
- **THEN** the sidebar MUST render that row as a folder-specific tree node rather than as a file row
- **AND** activating the folder row MUST expand or collapse the folder instead of opening an editor tab

### Requirement: Workbench SHALL expose a `NEW` action for `working`
The workbench SHALL expose a dedicated `NEW` action inside the workspace sidebar for creating new `working` entries without reusing the composer upload surface.

#### Scenario: NEW is available only for working content
- **WHEN** the user views the workspace sidebar
- **THEN** the sidebar MUST expose a `NEW` action for the `working` area
- **AND** the workbench MUST NOT expose that manual creation action for `input`

#### Scenario: NEW can create working folders and supported blank files
- **WHEN** the user opens the `NEW` action menu
- **THEN** the menu MUST expose `新建文件夹`、`新建 TXT`、`新建 MD`、`新建 MML`
- **AND** selecting one of those actions MUST create the corresponding entry under `working`

#### Scenario: NEW uses the current working directory context
- **WHEN** the user triggers `NEW` while a `working` folder or file is selected
- **THEN** the created entry MUST default to that folder context or the selected file's parent directory
- **AND** if no working-context selection exists the created entry MUST default to the `working` root

### Requirement: Workbench SHALL support explicit working folder rename from the tree
The workbench SHALL let users explicitly rename `working` folders from the workspace tree while keeping folder rename within the same parent directory.

#### Scenario: Folder row action exposes rename
- **WHEN** the user opens the secondary action menu for a `working` folder node
- **THEN** the menu MUST expose a `重命名` action for that folder
- **AND** invoking that secondary action MUST NOT also expand the folder row

#### Scenario: Folder rename is inline and basename-only
- **WHEN** the user triggers rename for a `working` folder
- **THEN** the workbench MUST replace the visible folder-name region with an inline editing control
- **AND** the frontend MUST NOT offer UI affordances for moving the folder to another parent directory in that rename flow

#### Scenario: Successful folder rename refreshes the tree in place
- **WHEN** a working-folder rename request succeeds
- **THEN** the renamed folder MUST appear in the tree under its new path
- **AND** descendant file and folder nodes MUST continue to appear under that renamed branch after the workspace metadata refresh

### Requirement: Workbench SHALL auto-save editable workspace files on blur and navigation boundaries
The workbench SHALL auto-save editable workspace files on the first-version navigation boundaries instead of requiring an explicit manual save click for the normal editing flow.

#### Scenario: Editor blur triggers auto-save for an editable dirty file
- **WHEN** an editable workspace file has unsaved local changes and the editor loses focus
- **THEN** the workbench MUST issue a save request for that file automatically
- **AND** a successful save MUST clear the file's dirty state

#### Scenario: Switching active files saves the current dirty file first
- **WHEN** the user attempts to switch from one editable workspace file to another while the current file has unsaved local changes
- **THEN** the workbench MUST attempt to save the current file before completing the active-file switch
- **AND** the target file MUST NOT replace the current editor context until that save either succeeds or fails explicitly

#### Scenario: Closing an editable dirty file saves before the tab closes
- **WHEN** the user closes an editable workspace file tab that still has unsaved local changes
- **THEN** the workbench MUST attempt to save that file before removing the tab from the open editor state
- **AND** a failed save MUST remain visible instead of being silently ignored
