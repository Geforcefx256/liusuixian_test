## MODIFIED Requirements

### Requirement: Runtime workspace metadata SHALL support workspace sidebar entry and minimal workspace opening
The runtime SHALL expose `user + agent` scoped workspace metadata and supported file-open/save contracts that are sufficient for the frontend to render the right-side workspace sidebar, open supported files for review, and persist in-place corrections without introducing user-visible file version management in this change.

#### Scenario: Workspace metadata can populate sidebar groups and file entries
- **WHEN** a client requests workspace metadata for the current authenticated user and selected agent
- **THEN** the runtime MUST return enough structured metadata to render workspace groupings and file-entry labels in the right-side workspace sidebar
- **AND** each file entry MUST expose a stable identifier that the frontend can use for file selection and workspace opening

#### Scenario: Workspace metadata is not keyed by session title
- **WHEN** the client switches between multiple sessions for the same user and agent
- **THEN** the runtime MUST continue to resolve the same workspace metadata scope for that `user + agent` pair
- **AND** the runtime MUST NOT require the workspace heading or root grouping to be derived from a session title

#### Scenario: Opening a supported workspace file returns an editor-capable payload
- **WHEN** a client opens a supported workspace file from the sidebar or a referenced artifact result
- **THEN** the runtime MUST return the file descriptor and content payload needed for the frontend to render that file in the workspace editor
- **AND** the returned payload MUST identify the supported file mode needed for plain text, Markdown, CSV, or recognized MML text handling

#### Scenario: Saving a supported workspace file updates the current file in place
- **WHEN** a client saves updates to a supported workspace file in the current `user + agent` workspace
- **THEN** the runtime MUST persist the new file content against that same workspace file
- **AND** the runtime MUST NOT require the client to create or choose a visible versioned copy

### Requirement: Uploaded files SHALL become reusable workspace entries for the current `user + agent` workspace
The runtime SHALL treat uploaded files as reusable workspace entries so that uploaded assets can appear in the workspace sidebar and participate in later workspace-opening flows across sessions for the same `user + agent` workspace.

#### Scenario: Upload response can be associated with the active agent workspace
- **WHEN** a user uploads one or more supported files for the active workbench flow
- **THEN** the runtime MUST return metadata that can be associated with the current `user + agent` workspace
- **AND** the frontend MUST be able to place those uploaded assets into the workspace sidebar without inventing transient identifiers client-side

#### Scenario: Markdown upload becomes a reusable workspace entry
- **WHEN** a user uploads a supported `.md` file for the active workbench flow
- **THEN** the runtime MUST accept that upload
- **AND** the resulting workspace entry MUST later open as a Markdown-mode file for that same `user + agent` workspace

#### Scenario: Different sessions can recover the same workspace entries
- **WHEN** the user opens different persisted sessions for the same active agent
- **THEN** the runtime MUST allow the frontend to recover the same `user + agent` workspace entries for sidebar rendering across those sessions

### Requirement: Runtime run results SHALL expose structured outputs needed for rich workbench messages
The runtime SHALL preserve structured terminal result metadata so that the workbench can distinguish protocol outputs, structured domain results, and structured runtime failures.

#### Scenario: Completed run returns protocol output distinctly
- **WHEN** a run completes with protocol output
- **THEN** the terminal run result MUST identify that output as protocol-capable rather than only plain text

#### Scenario: Completed run returns structured domain result distinctly
- **WHEN** a run completes with a structured domain result such as row preview data or an artifact reference
- **THEN** the terminal run result MUST identify that structured result distinctly from plain text
- **AND** the runtime MUST preserve the structured payload needed by the frontend to render a richer message surface
- **AND** artifact references MUST continue to preserve the file identity fields needed by the frontend to open the referenced workspace file through the existing artifact entry point

#### Scenario: Failed run returns structured runtime failure metadata
- **WHEN** a run terminates in error
- **THEN** the runtime MUST include structured runtime failure metadata in its terminal failure contract
- **AND** the client MUST be able to distinguish that structured failure context from a generic text-only error string
