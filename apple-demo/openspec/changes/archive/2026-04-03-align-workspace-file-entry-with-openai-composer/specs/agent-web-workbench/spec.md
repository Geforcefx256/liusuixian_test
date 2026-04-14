## ADDED Requirements

### Requirement: Workbench conversation composer SHALL support direct drag-and-drop upload on the composer surface
The authenticated workbench SHALL allow users to drag supported files directly onto the composer surface so that drag-and-drop upload follows the same governed attachment flow as the `+` trigger without expanding into a whole-page drop target.

#### Scenario: Dragging supported files highlights only the composer surface
- **WHEN** the user drags one or more supported files over the composer area in either the base shell or the workspace-expanded shell
- **THEN** the workbench MUST highlight only the composer surface as the active drop target
- **AND** the workbench MUST NOT dim or convert the entire page into a global drop zone

#### Scenario: Dropping multiple supported files reuses the normal upload flow
- **WHEN** the user drops multiple supported files onto the highlighted composer surface
- **THEN** the workbench MUST submit all dropped files through the normal workspace upload flow
- **AND** the resulting uploaded entries MUST become available in the workspace sidebar just as if they were selected from the file picker

#### Scenario: Unsupported drag-and-drop files fail explicitly
- **WHEN** the user drops a file whose type is outside the governed `TXT / MD / CSV` upload contract
- **THEN** the workbench MUST reject that drop explicitly
- **AND** the failure MUST remain visible to the user rather than silently ignoring the dropped file

## MODIFIED Requirements

### Requirement: Workbench SHALL provide a persistent workspace sidebar and a minimal workspace-open shell
The system SHALL treat the right-side work area as a persistent workspace sidebar for the current `user + agent` workspace and SHALL open a central file review-and-correction shell for supported files while keeping the conversation surface visible and conversation-led, including runtime-written output files that join the same workspace, while distinguishing read-only uploaded reference materials from writable generated results.

#### Scenario: Workspace sidebar is visible during normal conversation
- **WHEN** the user is in the base workbench shell
- **THEN** the right side MUST show a workspace sidebar rather than status-summary cards
- **AND** that sidebar MUST expose peer tabs for `工作空间` and `模板`
- **AND** the workspace tab MUST expose file groups and file items without rendering a workspace-scoped upload or blank-file creation entry point

#### Scenario: Workspace heading does not reuse session naming
- **WHEN** the user views the right-side workspace sidebar while switching between sessions for the same agent
- **THEN** the workspace root grouping MUST continue to represent the current `user + agent` workspace
- **AND** the sidebar MUST NOT present the selected session title as the workspace title
- **AND** the sidebar MUST NOT render redundant repeated headings such as an additional `工作区文件` headline or a repeated `小曼智能体工作区`-style title above the file tree

#### Scenario: Workspace groups use user-facing file-role labels
- **WHEN** the workbench renders grouped files in the `工作空间` tab
- **THEN** uploaded read-only files MUST appear under the user-facing group label `参考资料`
- **AND** runtime-written or otherwise writable workspace files MUST appear under the user-facing group label `生成结果`

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

### Requirement: Workbench conversation composer SHALL use an upload-first file entry model
The authenticated workbench SHALL treat the conversation composer as the primary upload entry surface for workspace files rather than as a mixed upload-and-create area or a second workspace-management surface.

#### Scenario: Composer primary file action is a compact attachment trigger
- **WHEN** the user views the conversation composer in either the base shell or the workspace-expanded shell
- **THEN** the primary left-side file action MUST render as a compact `+` attachment trigger rather than a text button labeled `上传文件`
- **AND** activating that trigger MUST open the governed file picker immediately

#### Scenario: Composer file picker supports one selection with multiple files
- **WHEN** the user selects more than one supported file from the governed file picker opened by the `+` trigger
- **THEN** the workbench MUST submit all selected files through the normal workspace upload flow
- **AND** the composer MUST NOT require the user to reopen the picker separately for each file in that one selection

#### Scenario: Blank file creation is no longer exposed from shell controls
- **WHEN** the user uses the authenticated workbench
- **THEN** the frontend MUST NOT present blank-file creation actions in the composer or the workspace sidebar
- **AND** the workbench MUST NOT imply that users can manually create empty workspace files from shell controls

### Requirement: Workbench conversation composer SHALL preserve a width-stable primary action row
The authenticated workbench SHALL keep the composer action row stable on supported desktop widths so that the compact attachment trigger and send controls remain readable without deforming the primary send action.

#### Scenario: Send action keeps a stable horizontal shape at constrained desktop widths
- **WHEN** the workbench is rendered in a supported laptop-width desktop layout with limited horizontal space
- **THEN** the send action MUST retain a readable horizontal button shape
- **AND** the workbench MUST NOT collapse that action into a narrow vertical pill solely because the compact attachment trigger competes for width

#### Scenario: Composer row stays minimal and does not reintroduce passive upload chrome
- **WHEN** the composer renders its primary action row
- **THEN** the upload entry cluster MUST remain limited to the compact `+` trigger rather than a text button plus auxiliary help controls
- **AND** the workbench MUST NOT reserve permanent row width for passive upload-copy or separate visible help affordances

## REMOVED Requirements

### Requirement: Workbench conversation composer SHALL disclose supported upload formats through a compact upward help affordance
**Reason**: The composer is moving to an extreme minimal attachment model centered on a compact `+` trigger, and visible helper chrome is no longer part of the primary row.
**Migration**: Remove the helper affordance and rely on governed file picker restrictions, drag-and-drop validation, and explicit upload errors to communicate unsupported file types.
