## MODIFIED Requirements

### Requirement: Runtime workspace metadata SHALL support workspace sidebar entry and minimal workspace opening
The runtime SHALL expose `user + agent` scoped workspace metadata and supported file-open/save contracts that are sufficient for the frontend to render the right-side workspace sidebar, open supported files for review, persist in-place corrections, and recover runtime-written output files without introducing user-visible file version management in this change.

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

#### Scenario: Runtime-written output files are recoverable through workspace metadata
- **WHEN** a runtime tool successfully writes a file into the current scoped workspace output area
- **THEN** the runtime MUST register that file as a workspace output entry that can later appear in the sidebar and be opened through the normal workspace file flow
- **AND** the workspace-visible label for that entry MUST preserve the file's full relative path inside the scoped `outputs/` root

## ADDED Requirements

### Requirement: Runtime SHALL provide a user-isolated workspace write tool
The runtime SHALL provide a `write` tool that writes text content only into the current authenticated `user + agent` workspace under the scoped `outputs/` subtree instead of the product repository workspace.

#### Scenario: Write path is resolved under the scoped output root
- **WHEN** a tool call requests a relative path such as `reports/final/result.txt`
- **THEN** the runtime MUST resolve that write under the current `user + agent` workspace `outputs/` root
- **AND** the runtime MUST reject absolute paths or normalized paths that escape that scoped output root

#### Scenario: Parent directories are created automatically
- **WHEN** a write tool call targets a nested relative path whose parent directories do not yet exist
- **THEN** the runtime MUST create those parent directories automatically before writing
- **AND** the write MUST succeed without requiring a separate directory-creation tool call

#### Scenario: Rewriting the same canonical path updates one tracked workspace file
- **WHEN** the write tool is called again for the same canonical relative path in the same `user + agent` workspace
- **THEN** the runtime MUST overwrite that existing workspace file instead of registering a duplicate output entry
- **AND** the workspace file identity used for sidebar opening and artifact references MUST remain stable for that path

#### Scenario: Successful write returns a workspace-openable artifact reference
- **WHEN** the write tool completes successfully
- **THEN** the runtime MUST return a structured `artifact_ref` result that identifies the written workspace file
- **AND** that reference MUST be sufficient for the frontend to open the file through the existing artifact-result workflow

#### Scenario: Write outputs follow the same workspace aging policy
- **WHEN** workspace output cleanup removes expired output files for a `user + agent` workspace
- **THEN** files created through the write tool MUST follow the same aging window as other workspace outputs
- **AND** expiration MUST remove the persisted file content and its tracked workspace entry together

#### Scenario: Write logs omit file body content
- **WHEN** the write tool starts, succeeds, or fails
- **THEN** runtime logs for that tool call MUST record metadata only rather than the raw file body or a body preview
- **AND** the metadata MUST still preserve enough information to identify the requested path, operation status, and traceable request context
