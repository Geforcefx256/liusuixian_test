## MODIFIED Requirements

### Requirement: Runtime workspace metadata SHALL support workspace sidebar entry and minimal workspace opening
The runtime SHALL expose `user + agent` scoped workspace metadata and supported file-open/save contracts that are sufficient for the frontend to render the right-side workspace sidebar with user-facing groups for read-only reference materials and generated results, open supported files for review or editing, reject writes to read-only uploaded inputs, and recover runtime-written output files without introducing user-visible file version management in this change.

#### Scenario: Workspace metadata can populate sidebar groups and file entries
- **WHEN** a client requests workspace metadata for the current authenticated user and selected agent
- **THEN** the runtime MUST return enough structured metadata to render workspace groupings and file-entry labels in the right-side workspace sidebar
- **AND** each file entry MUST expose a stable frontend identifier together with the workspace path or label needed for display and later workspace opening

#### Scenario: Workspace metadata uses user-facing file-role labels
- **WHEN** the runtime shapes grouped workspace metadata for the sidebar
- **THEN** uploaded read-only workspace entries MUST be grouped under the user-facing label `参考资料`
- **AND** runtime-written or otherwise writable workspace entries MUST be grouped under the user-facing label `生成结果`

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
