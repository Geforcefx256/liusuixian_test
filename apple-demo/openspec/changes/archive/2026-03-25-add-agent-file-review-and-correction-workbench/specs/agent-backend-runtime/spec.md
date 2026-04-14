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
- **AND** the returned payload MUST identify the supported file mode needed for `txt`, `csv`, or recognized MML text handling

#### Scenario: Saving a supported workspace file updates the current file in place
- **WHEN** a client saves updates to a supported workspace file in the current `user + agent` workspace
- **THEN** the runtime MUST persist the new file content against that same workspace file
- **AND** the runtime MUST NOT require the client to create or choose a visible versioned copy

## ADDED Requirements

### Requirement: Runtime SHALL expose active-file-aware invocation context for workspace follow-up actions
The runtime SHALL allow follow-up Agent actions to include an explicit active workspace file so the current file can be treated as the primary file context while preserving the wider workspace as supplementary context.

#### Scenario: Active file is accepted as primary follow-up context
- **WHEN** a client starts a follow-up Agent run from the workspace flow and includes an active workspace file
- **THEN** the runtime MUST preserve that active file distinctly from the broader workspace file list
- **AND** downstream execution MUST be able to treat that active file as the primary file context for the run

#### Scenario: Workspace file list remains available as supplementary context
- **WHEN** a client submits an active file together with other available workspace files
- **THEN** the runtime MUST preserve the wider workspace file list for supplementary context
- **AND** the presence of those additional files MUST NOT erase the identity of the active file

### Requirement: Runtime SHALL recognize and update standard MML headers for supported text files
The runtime SHALL recognize standard leading MML header comments in supported text files and SHALL support round-tripping those parsed values through file-open and file-save operations.

#### Scenario: Opening a text file with a standard MML header returns parsed MML metadata
- **WHEN** a supported text file begins with a header comment of the form `/* ME TYPE=<type>, Version=<version> */`
- **THEN** the runtime MUST identify that file as MML-capable for the workspace editor
- **AND** the file-open payload MUST include the parsed `网元类型` and `网元版本` values needed by the frontend toolbar

#### Scenario: Saving updated MML metadata rewrites the file header
- **WHEN** a client saves an opened MML file after changing the parsed `网元类型` or `网元版本`
- **THEN** the runtime MUST rewrite the leading MML header comment to reflect the saved values
- **AND** later opens of that file MUST return the updated parsed metadata

#### Scenario: Text file without a recognized MML header remains plain text
- **WHEN** a supported text file does not contain a recognized leading MML header comment
- **THEN** the runtime MUST treat that file as a normal text file for workspace opening
- **AND** the runtime MUST NOT fabricate MML toolbar metadata for that file
