## ADDED Requirements

### Requirement: Workbench SHALL provide current-file text search controls in the workspace editor shell
When the user opens an editable text-based workspace file in the workbench editor shell, the shell SHALL expose a mouse-friendly current-file search flow that keeps the default toolbar compact while making search, replace, and undo discoverable.

#### Scenario: Text editor toolbar stays compact by default
- **WHEN** the user views a supported text-based workspace file in text view and the search flow is not expanded
- **THEN** the workbench toolbar MUST show `搜索`, `保存`, and `更多` as the visible editing actions
- **AND** the toolbar MUST NOT render `替换` as a separate always-visible top-level action

#### Scenario: Search button expands an inline current-file search bar
- **WHEN** the user clicks `搜索` while a supported text-based workspace file is active in text view
- **THEN** the workbench MUST expand an inline search bar above the current editor content instead of opening a modal
- **AND** that search bar MUST scope its search behavior to the currently open file only
- **AND** the search bar MUST expose search input, `上一个`, `下一个`, and `关闭`

#### Scenario: Replace controls stay nested inside the search flow
- **WHEN** the inline search bar is open and the user chooses to reveal replace controls
- **THEN** the workbench MUST show the replace input within the same inline search area
- **AND** the replace area MUST expose `替换当前` and `全部替换`
- **AND** those replace actions MUST apply only to matches in the currently open file

#### Scenario: Undo is available from the more menu for text editing
- **WHEN** a supported text-based workspace file is active in text view and the user opens `更多`
- **THEN** the menu MUST expose a clickable `撤销` action
- **AND** triggering `撤销` MUST revert only the current text editor's text-edit history
- **AND** that action MUST NOT claim to undo table-view edits or workspace-wide changes

#### Scenario: Non-text views do not imply unsupported search scope
- **WHEN** the active file is shown in preview view or table view instead of text view
- **THEN** the workbench MUST NOT present the inline current-file text search bar as an active editing surface for that view
- **AND** the shell MUST NOT imply that search or replace is operating across the whole workspace
