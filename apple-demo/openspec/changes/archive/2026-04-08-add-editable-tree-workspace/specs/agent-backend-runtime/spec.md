## MODIFIED Requirements

### Requirement: Runtime SHALL expose `user + agent` scoped workspace metadata and supported file-open/save contracts
The runtime SHALL expose `user + agent` scoped workspace metadata and supported file-open/save contracts that are sufficient for the frontend to render the right-side workspace sidebar as `input` and `working` trees, open supported files for review or editing, save editable files in place, and recover runtime-written output files without introducing user-visible file version management in this change.

#### Scenario: Workspace metadata can populate grouped tree nodes
- **WHEN** a client requests workspace metadata for the current authenticated user and selected agent
- **THEN** the runtime MUST return enough structured metadata to render `input` and `working` groupings together with file and folder tree nodes
- **AND** each node MUST expose a stable frontend identifier together with the workspace-relative path or label needed for display and later interaction

#### Scenario: Workspace metadata uses `input` and `working` labels
- **WHEN** the runtime shapes grouped workspace metadata for the sidebar
- **THEN** uploaded user materials MUST be grouped under the user-facing label `input`
- **AND** runtime-written or manually created workspace files and folders MUST be grouped under the user-facing label `working`

#### Scenario: Workspace metadata is not keyed by session title
- **WHEN** the client switches between multiple sessions for the same user and agent
- **THEN** the runtime MUST continue to resolve the same workspace metadata scope for that `user + agent` pair
- **AND** the runtime MUST NOT require the workspace heading or root grouping to be derived from a session title

#### Scenario: Opening a supported workspace file returns an editor-capable payload with writability
- **WHEN** a client opens a supported workspace file from the sidebar or a referenced artifact result
- **THEN** the runtime MUST return the file descriptor and content payload needed for the frontend to render that file in the workspace editor
- **AND** the returned payload MUST identify the supported file mode, workspace-relative path, source, and whether that file is writable

#### Scenario: Saving an editable workspace file updates the current file in place
- **WHEN** a client saves updates to an editable workspace file in either `input` or `working` within the current `user + agent` workspace
- **THEN** the runtime MUST persist the new file content against that same workspace file
- **AND** the runtime MUST NOT require the client to create or choose a visible versioned copy

#### Scenario: Runtime-written output files are recoverable through workspace metadata
- **WHEN** a runtime tool successfully writes a file into the current scoped workspace `outputs/` root
- **THEN** the runtime MUST register that file as a `working` workspace entry that can later appear in the sidebar and be opened through the normal workspace file flow
- **AND** the workspace-visible label for that entry MUST preserve the file's full relative path inside the scoped `outputs/` root

### Requirement: Uploaded files SHALL become reusable workspace entries for the current `user + agent` workspace
The runtime SHALL treat uploaded files as reusable editable `input` workspace entries so that uploaded assets can appear in the workspace sidebar, preserve their original filenames or relative paths, participate in later workspace-opening flows across sessions for the same `user + agent` workspace, and accept in-place saves.

#### Scenario: Upload response can be associated with the active agent workspace
- **WHEN** a user uploads one or more supported files for the active workbench flow
- **THEN** the runtime MUST return metadata that can be associated with the current `user + agent` workspace
- **AND** the frontend MUST be able to place those uploaded assets into the workspace sidebar without inventing transient identifiers client-side

#### Scenario: Uploaded entry preserves relative path and opens with the correct mode
- **WHEN** a user uploads a supported text, Markdown, or CSV file for the active workbench flow
- **THEN** the resulting workspace entry MUST preserve the user-visible relative path shown in the `input` tree
- **AND** opening that entry later MUST still resolve the supported editor mode appropriate for that file content

#### Scenario: Uploaded input files can be saved in place
- **WHEN** a client saves an uploaded workspace file in the current `user + agent` scope
- **THEN** the runtime MUST write the updated content back to that tracked upload path
- **AND** later workspace metadata and file-open requests MUST continue to resolve the same uploaded entry identity

#### Scenario: UTF-8 multipart filename remains readable across the workspace flow
- **WHEN** a client uploads a supported file whose multipart filename or relative path contains UTF-8 characters such as Chinese
- **THEN** the runtime MUST preserve that user-visible path without mojibake in the upload response, workspace metadata, and later file-open payloads
- **AND** the stored workspace entry MUST remain reachable through the normal scoped upload path derived from that readable path

#### Scenario: Different sessions can recover the same uploaded workspace entries
- **WHEN** the user opens different persisted sessions for the same active agent
- **THEN** the runtime MUST allow the frontend to recover the same `user + agent` workspace entries for sidebar rendering across those sessions

### Requirement: Runtime SHALL enforce the governed workbench composer upload contract
The runtime SHALL enforce the file-format contract exposed by the authenticated workbench composer so that accepted uploads become reusable `input` workspace entries, relative paths can be preserved when supplied, and unsupported uploads fail explicitly.

#### Scenario: Composer upload accepts governed text and table formats
- **WHEN** a client uploads a `.txt`, `.md`, or `.csv` file through the authenticated workbench composer flow
- **THEN** the runtime MUST accept that file into the current `user + agent` workspace
- **AND** the resulting upload MUST remain available through the existing reusable workspace-entry and file-open flows

#### Scenario: Composer upload can preserve directory-backed relative paths
- **WHEN** a client uploads a governed file through the same composer flow together with a relative path supplied by the frontend
- **THEN** the runtime MUST store that file under the corresponding scoped upload-relative path
- **AND** the resulting workspace metadata MUST preserve that same relative path for tree rendering

#### Scenario: Unsupported composer upload is rejected explicitly
- **WHEN** a client uploads a file with an unsupported extension through the same composer upload flow
- **THEN** the runtime MUST reject that upload with an explicit validation failure
- **AND** the runtime MUST NOT create a reusable workspace entry for the rejected file

#### Scenario: Accepted txt uploads remain compatible with later MML-aware file opening
- **WHEN** the runtime accepts a `.txt` upload from the composer flow
- **THEN** the stored workspace file MUST remain compatible with the existing plain-text and MML-aware open-path rules
- **AND** the governed composer contract MUST still be expressed to users as `TXT / MD / CSV` rather than as a separate `MML` upload class

### Requirement: Runtime workspace file APIs SHALL support constrained rename within the current user-agent scope
The runtime SHALL expose an explicit workspace file rename contract that allows the authenticated client to rename uploaded workspace files and path-addressed `working` workspace files within the current `user + agent` scope while preserving file identity.

#### Scenario: Client renames an uploaded workspace file in scope
- **WHEN** an authenticated client renames an uploaded workspace file in the current `user + agent` scope using a new basename with the same extension
- **THEN** the runtime MUST keep that file's stable identity fields unchanged
- **AND** the runtime MUST preserve the file's existing parent directory while replacing only the final basename segment

#### Scenario: Client renames a path-addressed working file in scope
- **WHEN** an authenticated client renames a writable working workspace file that has a stored relative path
- **THEN** the runtime MUST preserve that file's existing parent directory within the scoped working root
- **AND** the runtime MUST replace only the final basename segment with the new basename

#### Scenario: Runtime rejects rename outside the current workspace scope
- **WHEN** a client attempts to rename a workspace file that does not belong to the current authenticated `user + agent` scope
- **THEN** the runtime MUST reject that rename request
- **AND** the runtime MUST NOT mutate metadata or disk files belonging to another scope

## ADDED Requirements

### Requirement: Runtime workspace metadata SHALL support explicit working folders
The runtime SHALL persist explicit `working` folder entries so the frontend can render empty folders, preserve stable folder identity, and reconcile folder renames without inventing synthetic placeholder nodes client-side.

#### Scenario: Working folder entry appears in workspace metadata without child files
- **WHEN** a user creates an empty folder under `working`
- **THEN** the runtime MUST persist a tracked workspace folder entry for that directory
- **AND** later workspace metadata reads MUST continue to expose that folder even when it contains no files

#### Scenario: Working folder metadata coexists with path-derived parent folders
- **WHEN** workspace metadata includes explicit working-folder entries together with files nested under deeper paths
- **THEN** the runtime MUST expose enough relative-path and node-type information for the frontend to build one coherent tree
- **AND** the runtime MUST NOT require the frontend to guess which empty folders are authoritative

### Requirement: Runtime workspace APIs SHALL support explicit working file and folder creation
The runtime SHALL expose explicit creation contracts for `working` files and folders within the current `user + agent` scope.

#### Scenario: Client creates a working folder
- **WHEN** an authenticated client requests creation of a folder under a valid `working` parent directory
- **THEN** the runtime MUST create that folder under the scoped working storage root
- **AND** the runtime MUST return tracked workspace metadata for the created folder

#### Scenario: Client creates a supported blank working file
- **WHEN** an authenticated client requests creation of a blank `TXT`、`MD`、or `MML` file under a valid `working` parent directory
- **THEN** the runtime MUST create that file with the correct extension under the scoped working storage root
- **AND** the runtime MUST return an editor-openable workspace file descriptor for the created file

#### Scenario: Create request fails explicitly on collision
- **WHEN** the requested working file or folder path already exists in the current `user + agent` workspace
- **THEN** the runtime MUST reject the create request explicitly
- **AND** the runtime MUST NOT auto-generate a different fallback name

### Requirement: Runtime workspace folder APIs SHALL support constrained rename within the current user-agent scope
The runtime SHALL expose an explicit folder-rename contract that allows the authenticated client to rename tracked `working` folders within the same parent directory while preserving descendant content.

#### Scenario: Client renames a tracked working folder in scope
- **WHEN** an authenticated client renames a tracked `working` folder using a new basename within the same parent directory
- **THEN** the runtime MUST keep that folder's stable identity unchanged
- **AND** the runtime MUST update descendant file and folder paths to resolve under the renamed branch

#### Scenario: Runtime rejects working-folder rename outside the v1 boundary
- **WHEN** a client attempts to rename a tracked working folder using a path that changes its parent directory or collides with another tracked folder
- **THEN** the runtime MUST reject that rename request explicitly
- **AND** the runtime MUST leave the existing folder metadata and disk paths unchanged
