## ADDED Requirements

### Requirement: Workbench SHALL keep the workspace sidebar compact while revealing complete file names
The workbench SHALL keep workspace file rows in a compact single-line tree layout and SHALL preserve full file-name readability through explicit reveal behavior instead of allowing long names to become permanently unreadable. When a file name exceeds the available sidebar width, the rendered label MUST preserve file extension recognizability.

#### Scenario: Long file names remain compact without losing extension recognizability
- **WHEN** the workspace sidebar renders a file whose name exceeds the available row width
- **THEN** the row MUST remain single-line and compact
- **AND** the rendered label MUST preserve the file extension as recognizable text
- **AND** the sidebar MUST NOT switch to a default multi-line file-row layout

#### Scenario: Pointer hover reveals the complete file name
- **WHEN** a user hovers a workspace file row whose rendered label is truncated
- **THEN** the workbench MUST reveal the complete file name for that row
- **AND** the revealed value MUST match the exact current file name

#### Scenario: Keyboard focus reveals the complete file name
- **WHEN** keyboard focus moves onto a workspace file row whose rendered label is truncated
- **THEN** the workbench MUST reveal the complete file name for that row
- **AND** the reveal behavior MUST NOT require pointer hover to work

### Requirement: Workbench SHALL provide stable selected-file naming and copy-file-name actions
The workbench SHALL provide a stable full-name presentation for the currently selected workspace file and SHALL expose a `复制文件名` action within the same file-action layer as rename, download, and delete.

#### Scenario: Selected file shows a stable complete file name
- **WHEN** a user selects or opens a workspace file
- **THEN** the workspace-expanded shell MUST display the complete current file name in a stable selected-file context area
- **AND** the complete file name MUST remain visible without requiring hover

#### Scenario: Selected file exposes copy-file-name with other file actions
- **WHEN** the current selected-file context exposes file actions
- **THEN** the action set MUST include `复制文件名`
- **AND** that action MUST be grouped with rename, download, and delete for the same current file

#### Scenario: Copy-file-name copies the exact current file name
- **WHEN** a user triggers `复制文件名` for a workspace file
- **THEN** the workbench MUST write the exact current file name, including extension, to the clipboard
- **AND** the workbench MUST provide an explicit success acknowledgment after the copy completes

#### Scenario: Copy-file-name failure is surfaced explicitly
- **WHEN** the workbench cannot complete `复制文件名`
- **THEN** the workbench MUST surface an explicit error to the user
- **AND** the workbench MUST NOT silently report copy success
