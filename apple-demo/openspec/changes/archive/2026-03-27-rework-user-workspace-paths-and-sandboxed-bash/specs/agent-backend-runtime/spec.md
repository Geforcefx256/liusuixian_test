## ADDED Requirements

### Requirement: Runtime local workspace tools SHALL use scoped workspace-relative paths
The runtime SHALL expose model-facing file discovery and file reading behavior against the current authenticated `user + agent` workspace using workspace-relative paths rather than product-root paths or opaque file handles.

#### Scenario: Discovery and read tools resolve inside the current scoped workspace
- **WHEN** the runtime serves `find_files`, `list_directory`, or `read_file` for a request
- **THEN** those tools MUST resolve paths relative to the current scoped workspace root
- **AND** any path that escapes that scoped workspace root MUST be rejected explicitly

#### Scenario: LLM-visible file hints use workspace-relative paths
- **WHEN** the runtime includes active-file or follow-up file hints for a run
- **THEN** it MUST describe those files using workspace-relative paths
- **AND** it MUST NOT require `fileKey` or `@file:<fileKey>` syntax in the model-facing contract

### Requirement: Runtime uploads SHALL preserve original filenames and require explicit overwrite intent
The runtime SHALL store uploaded workspace inputs under their original filenames within the current `user + agent` scoped `uploads/` root and SHALL reject same-path replacement unless the client explicitly confirms overwrite intent.

#### Scenario: Upload preserves the original filename
- **WHEN** a user uploads a supported file such as `foo.csv` for the current agent workspace
- **THEN** the runtime MUST persist it under the current scoped `uploads/` root using that original filename
- **AND** the workspace-visible label for that uploaded entry MUST preserve that original filename

#### Scenario: Same-name upload requires explicit overwrite confirmation
- **WHEN** a client uploads a file whose scoped `uploads/` path already exists without explicit overwrite intent
- **THEN** the runtime MUST reject or block that upload with an explicit conflict-style result
- **AND** the existing uploaded file content MUST remain unchanged

#### Scenario: Confirmed overwrite replaces the existing uploaded file
- **WHEN** a client repeats the upload with explicit overwrite confirmation for the same scoped `uploads/` path
- **THEN** the runtime MUST replace that uploaded file content in place
- **AND** the scoped upload path and workspace entry label MUST remain stable after replacement

### Requirement: Runtime uploaded inputs SHALL remain immutable from workspace editing flows
The runtime SHALL treat files under the scoped `uploads/` root as immutable user-provided inputs rather than writable workspace outputs.

#### Scenario: Opening an uploaded file returns a read-only editor contract
- **WHEN** a client opens a workspace file sourced from the scoped `uploads/` root
- **THEN** the runtime MUST return the file content together with metadata indicating that the file is read-only
- **AND** the returned source and path metadata MUST let the client distinguish it from writable outputs or temp files

#### Scenario: Saving an uploaded file is rejected
- **WHEN** a client attempts to save changes against a workspace file sourced from the scoped `uploads/` root
- **THEN** the runtime MUST reject that save request
- **AND** the persisted uploaded file content MUST remain unchanged

## MODIFIED Requirements

### Requirement: Runtime workspace metadata SHALL support workspace sidebar entry and minimal workspace opening
The runtime SHALL expose `user + agent` scoped workspace metadata and supported file-open/save contracts that are sufficient for the frontend to render the right-side workspace sidebar, open supported files for review or editing, reject writes to read-only uploaded inputs, and recover runtime-written output files without introducing user-visible file version management in this change.

#### Scenario: Workspace metadata can populate sidebar groups and file entries
- **WHEN** a client requests workspace metadata for the current authenticated user and selected agent
- **THEN** the runtime MUST return enough structured metadata to render workspace groupings and file-entry labels in the right-side workspace sidebar
- **AND** each file entry MUST expose a stable frontend identifier together with the workspace path or label needed for display and later workspace opening

#### Scenario: Workspace metadata is not keyed by session title
- **WHEN** the client switches between multiple sessions for the same user and agent
- **THEN** the runtime MUST continue to resolve the same workspace metadata scope for that `user + agent` pair
- **AND** the runtime MUST NOT require the workspace heading or root grouping to be derived from a session title

#### Scenario: Opening a supported workspace file returns an editor-capable payload with writability
- **WHEN** a client opens a supported workspace file from the sidebar or a referenced artifact result
- **THEN** the runtime MUST return the file descriptor and content payload needed for the frontend to render that file in the workspace editor
- **AND** the returned payload MUST identify the supported file mode, workspace-relative path, source, and whether that file is writable

#### Scenario: Saving a writable workspace file updates the current file in place
- **WHEN** a client saves updates to a writable workspace file in the current `user + agent` workspace
- **THEN** the runtime MUST persist the new file content against that same workspace file
- **AND** the runtime MUST NOT require the client to create or choose a visible versioned copy

#### Scenario: Runtime-written output files are recoverable through workspace metadata
- **WHEN** a runtime tool successfully writes a file into the current scoped workspace `outputs/` root
- **THEN** the runtime MUST register that file as a workspace output entry that can later appear in the sidebar and be opened through the normal workspace file flow
- **AND** the workspace-visible label for that entry MUST preserve the file's full relative path inside the scoped `outputs/` root

### Requirement: Uploaded files SHALL become reusable workspace entries for the current `user + agent` workspace
The runtime SHALL treat uploaded files as reusable read-only workspace entries so that uploaded assets can appear in the workspace sidebar, preserve their original filenames, and participate in later workspace-opening flows across sessions for the same `user + agent` workspace.

#### Scenario: Upload response can be associated with the active agent workspace
- **WHEN** a user uploads one or more supported files for the active workbench flow
- **THEN** the runtime MUST return metadata that can be associated with the current `user + agent` workspace
- **AND** the frontend MUST be able to place those uploaded assets into the workspace sidebar without inventing transient identifiers client-side

#### Scenario: Uploaded entry preserves original filename and opens with the correct mode
- **WHEN** a user uploads a supported text, Markdown, or CSV file for the active workbench flow
- **THEN** the resulting workspace entry MUST preserve the original filename shown to the user
- **AND** opening that entry later MUST still resolve the supported editor mode appropriate for that file content

#### Scenario: Different sessions can recover the same uploaded workspace entries
- **WHEN** the user opens different persisted sessions for the same active agent
- **THEN** the runtime MUST allow the frontend to recover the same `user + agent` workspace entries for sidebar rendering across those sessions

## REMOVED Requirements

### Requirement: Product workspace and template dependencies remain valid
**Reason**: Local file tools and command execution no longer use the product repository workspace as their model-facing root. The new contract is a scoped user workspace with a separate read-only runtime mount for governed references and scripts.

**Migration**: Update runtime tools, prompts, and governed skills to use scoped workspace-relative paths for discovery and reading, and use runtime-mounted references instead of product-root paths or `@file:<fileKey>` indirection.
