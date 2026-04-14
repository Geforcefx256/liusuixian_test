## ADDED Requirements

### Requirement: Workbench SHALL provide Markdown preview in the workspace editor
The workbench SHALL provide a dedicated Markdown preview path for workspace files identified as Markdown so users can review rendered document structure without leaving the workspace shell.

#### Scenario: Markdown file can switch between edit and preview views
- **WHEN** the user opens a Markdown workspace file in the expanded shell
- **THEN** the editor MUST provide both an edit view and a preview view for that file
- **AND** switching to preview MUST render the current workspace file content rather than a stale saved snapshot

#### Scenario: Markdown preview remains inside the standard workspace shell
- **WHEN** the user switches a Markdown workspace file into preview view
- **THEN** the workbench MUST keep the surrounding workspace shell, tabs, save controls, and conversation surface visible
- **AND** the workbench MUST NOT navigate the user into a separate document page or standalone viewer

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

### Requirement: Workspace editor SHALL present MML as an optional parsing mode for txt files
The workspace editor SHALL present MML as an optional parsing mode for supported `txt` files rather than as a permanent user-facing file type.

#### Scenario: Txt file exposes an MML parsing entry before activation
- **WHEN** the user opens a supported `txt` file in the workspace-expanded shell
- **THEN** the editor header MUST show a user-facing `按 MML 解析` entry
- **AND** the editor MUST NOT require the file to already be labeled as `MML` before that entry appears

#### Scenario: Enabling MML parsing exposes editable parsing configuration
- **WHEN** the user expands the `按 MML 解析` entry for a supported `txt` file
- **THEN** the editor MUST present editable `网元类型` and `网元版本` fields in a secondary configuration area
- **AND** the primary toolbar MUST keep those fields out of the always-visible primary row

#### Scenario: Table-view gating uses task-oriented language
- **WHEN** the user attempts to enter table view before MML parsing is ready
- **THEN** the editor MUST explain the blocked state using task-oriented copy such as missing configuration or temporary unsupported parsing
- **AND** the editor MUST NOT expose implementation terminology such as `Schema` in that user-facing messaging

#### Scenario: Markdown file does not expose MML parsing entry
- **WHEN** the user opens a Markdown workspace file in the expanded shell
- **THEN** the editor MUST NOT show the `按 MML 解析` entry for that file
- **AND** the workbench MUST NOT route that file through the MML parsing configuration flow

### Requirement: Workbench SHALL present a first batch of rich conversation results
The workbench SHALL present the first batch of rich result surfaces for structured runtime outputs and structured runtime failures without introducing a separate assistant cockpit.

#### Scenario: Structured row result renders as a conversation result card
- **WHEN** a completed run returns a structured row-preview result
- **THEN** the conversation surface MUST render a table-like preview card in the message stream
- **AND** the user MUST still be able to read the surrounding conversation normally

#### Scenario: Artifact reference renders as a conversation artifact card
- **WHEN** a completed run returns an artifact reference result
- **THEN** the conversation surface MUST render a dedicated artifact-oriented message card rather than leaving the payload as raw JSON text
- **AND** artifact actions for supported workspace files MUST continue to use the existing `打开文件` entry point regardless of whether the referenced file is Markdown

#### Scenario: Structured runtime failure renders as an error card
- **WHEN** a run fails and returns structured runtime failure metadata
- **THEN** the workbench MUST render an explicit failure-oriented message or card
- **AND** the user-facing error presentation MUST be more specific than a generic status string alone

### Requirement: Workbench SHALL use Monaco as the text editing engine for text-class workspace files
The workbench SHALL use Monaco as the editing engine for supported text-class workspace files while preserving CSV as a separate table-oriented editing path.

#### Scenario: Plain text file opens in a Monaco-backed text view
- **WHEN** the user opens a supported plain text workspace file in the expanded workspace shell
- **THEN** the text view MUST render through a Monaco-backed editor surface
- **AND** the workbench MUST keep the surrounding workspace shell actions for tabs, save, and continue processing outside the editor engine

#### Scenario: Markdown file opens in a Monaco-backed text view
- **WHEN** the user opens a supported Markdown workspace file in edit view
- **THEN** the workbench MUST render that file through the same Monaco-backed editor path used for other text-class files
- **AND** the workbench MUST keep the surrounding workspace shell actions for tabs, save, preview switching, and continue processing outside the editor engine
- **AND** the Markdown file's save state and save action MUST remain on the same primary toolbar row used by the current text-file workspace experience

#### Scenario: Markdown text view binds to a Markdown Monaco language id
- **WHEN** the user opens a supported Markdown workspace file in edit view
- **THEN** the text editor MUST bind that file to a Markdown Monaco language id rather than treating it as `plaintext`

#### Scenario: MML file text view opens in the same Monaco-backed editor path
- **WHEN** the user opens an MML-capable workspace file in text view
- **THEN** the workbench MUST render the file's raw text through the same Monaco-backed text editor path used for plain text files
- **AND** the workbench MUST NOT require a separate MML-only editor engine for this change

#### Scenario: MML text view binds to a dedicated Monaco language
- **WHEN** the user opens an MML-capable workspace file in text view
- **THEN** the text editor MUST bind that file to a dedicated MML Monaco language id
- **AND** the workbench MUST NOT continue to treat that file as `plaintext` for syntax tokenization

#### Scenario: CSV remains on the table-oriented editing path
- **WHEN** the user opens a CSV workspace file
- **THEN** the workbench MUST continue to use the table-oriented CSV view rather than routing that file through Monaco as the primary editing surface
