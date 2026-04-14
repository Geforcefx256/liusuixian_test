## ADDED Requirements

### Requirement: Workbench SHALL expose secondary workspace file actions through a row-level action menu
The workbench SHALL expose workspace file secondary actions through a row-level `更多` menu so that download and deletion remain separate from the main file-row selection and open affordances.

#### Scenario: File row keeps its main click area separate from the row action menu
- **WHEN** the user views a file entry in the `工作空间` sidebar tree
- **THEN** that row MUST expose a separate row-action trigger for secondary file actions
- **AND** invoking the row-action trigger MUST NOT also select or open the file

#### Scenario: Row action menu exposes the first-version file actions
- **WHEN** the user opens the row action menu for a workspace file
- **THEN** the menu MUST expose `下载` and `删除` as distinct actions
- **AND** `删除` MUST remain visually distinguishable as the higher-risk action

#### Scenario: Main file row semantics remain unchanged while using row actions
- **WHEN** the user clicks or double-clicks the main file-row area
- **THEN** the workbench MUST preserve the existing single-click selection and double-click open behavior
- **AND** the presence of the row action menu MUST NOT redefine those primary row semantics

### Requirement: Workbench SHALL support downloading workspace files from the sidebar
The workbench SHALL let users download workspace files from the sidebar row action menu without requiring them to open the file in the editor first.

#### Scenario: User downloads a workspace file from the row action menu
- **WHEN** the user chooses `下载` for a workspace file from the row action menu
- **THEN** the frontend MUST issue the scoped workspace download request for that file
- **AND** the browser MUST begin an attachment download for that file without opening or activating the workspace editor

#### Scenario: Download failure remains visible and does not mutate workspace editor state
- **WHEN** the workspace file download request fails
- **THEN** the workbench MUST surface that failure to the user explicitly
- **AND** the sidebar selection, open-file state, and editor content MUST remain unchanged
