## ADDED Requirements

### Requirement: Runtime session metadata SHALL support preview-rich workbench history rails
The runtime SHALL expose session-list metadata that is sufficient for the frontend to render a preview-rich history rail and perform explicit session deletion flows.

#### Scenario: Session list includes preview-ready metadata
- **WHEN** a client requests the session list for an agent
- **THEN** each returned session item MUST include a stable one-line preview string suitable for history-rail display
- **AND** each returned session item MUST continue to identify the session, title, and update timing needed for rail ordering and selection

#### Scenario: Session deletion removes persisted session state
- **WHEN** a client issues a confirmed delete for a session
- **THEN** the runtime MUST delete the persisted session record for that user and agent
- **AND** the runtime MUST remove persisted messages and related derived session state that belongs exclusively to that deleted session

### Requirement: Runtime workspace metadata SHALL support workspace sidebar entry and minimal workspace opening
The runtime SHALL expose `user + agent` scoped workspace metadata that is sufficient for the frontend to render the right-side workspace sidebar and open a minimal workspace shell without requiring full editing APIs in this change.

#### Scenario: Workspace metadata can populate sidebar groups and file entries
- **WHEN** a client requests workspace metadata for the current authenticated user and selected agent
- **THEN** the runtime MUST return enough structured metadata to render workspace groupings and file-entry labels in the right-side workspace sidebar
- **AND** each file entry MUST expose a stable identifier that the frontend can use for file selection and workspace opening

#### Scenario: Workspace metadata is not keyed by session title
- **WHEN** the client switches between multiple sessions for the same user and agent
- **THEN** the runtime MUST continue to resolve the same workspace metadata scope for that `user + agent` pair
- **AND** the runtime MUST NOT require the workspace heading or root grouping to be derived from a session title

#### Scenario: Opened workspace file can resolve minimal active-file context
- **WHEN** a client opens a workspace file from the sidebar
- **THEN** the runtime MUST provide the minimal file descriptor data needed for the frontend to identify the active file in the workspace shell
- **AND** this change MUST NOT require the runtime to provide full text-editing or table-editing APIs

### Requirement: Uploaded files SHALL become reusable workspace entries for the current `user + agent` workspace
The runtime SHALL treat uploaded files as reusable workspace entries so that uploaded assets can appear in the workspace sidebar and participate in later workspace-opening flows across sessions for the same `user + agent` workspace.

#### Scenario: Upload response can be associated with the active agent workspace
- **WHEN** a user uploads one or more supported files for the active workbench flow
- **THEN** the runtime MUST return metadata that can be associated with the current `user + agent` workspace
- **AND** the frontend MUST be able to place those uploaded assets into the workspace sidebar without inventing transient identifiers client-side

#### Scenario: Different sessions can recover the same workspace entries
- **WHEN** the user opens different persisted sessions for the same active agent
- **THEN** the runtime MUST allow the frontend to recover the same `user + agent` workspace entries for sidebar rendering across those sessions

### Requirement: Runtime workspace storage SHALL be isolated by `user + agent`
The runtime SHALL isolate workspace files, generated artifacts, and workspace metadata by the authenticated user and selected agent rather than mixing them in a single global workspace bucket.

#### Scenario: Different users do not share the same agent workspace
- **WHEN** two different authenticated users use the same agent
- **THEN** their uploaded files, generated files, and workspace metadata MUST remain isolated from each other

#### Scenario: Different agents do not share the same user workspace
- **WHEN** the same authenticated user uses two different agents
- **THEN** each agent MUST resolve an independent workspace scope for uploads, outputs, and workspace metadata
