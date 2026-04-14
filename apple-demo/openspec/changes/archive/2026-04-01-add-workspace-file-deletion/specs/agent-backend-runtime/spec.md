## ADDED Requirements

### Requirement: Runtime workspace file APIs SHALL support explicit deletion within the current user-agent scope
The runtime SHALL expose an explicit workspace file deletion contract that allows the authenticated client to delete uploaded workspace files and registered `output` files within the current `user + agent` workspace scope.

#### Scenario: Client deletes an uploaded or output workspace file
- **WHEN** an authenticated client issues a delete request for a workspace file in the current `user + agent` scope
- **THEN** the runtime MUST delete the corresponding workspace file metadata entry
- **AND** the runtime MUST delete the corresponding file from the scoped workspace storage when that file exists

#### Scenario: Runtime rejects deletion outside the current workspace scope
- **WHEN** a client attempts to delete a file that does not belong to the current authenticated `user + agent` scope
- **THEN** the runtime MUST reject that delete request
- **AND** the runtime MUST NOT delete metadata or files belonging to another scope

### Requirement: Runtime workspace metadata SHALL reflect deletions immediately
After a workspace file is deleted successfully, the runtime SHALL make the resulting workspace metadata authoritative for later workspace list and open flows.

#### Scenario: Deleted file no longer appears in workspace metadata
- **WHEN** a workspace file deletion succeeds
- **THEN** subsequent workspace metadata reads for the same `user + agent` scope MUST omit that file entry

#### Scenario: Deleted file can no longer be opened through the normal workspace file flow
- **WHEN** a workspace file has already been deleted successfully
- **THEN** later open requests for that file MUST fail explicitly
- **AND** the runtime MUST NOT fabricate a fallback file payload for the deleted entry

### Requirement: Runtime deletion flow SHALL preserve explicit failure visibility
The runtime SHALL keep deletion failures explicit so that clients can surface real file-state problems instead of silently degrading behavior.

#### Scenario: File system or persistence failure aborts the delete response
- **WHEN** the runtime cannot complete the workspace file deletion because file removal or metadata persistence fails
- **THEN** the delete request MUST fail explicitly
- **AND** the runtime MUST NOT return a synthetic success response that hides the failure
