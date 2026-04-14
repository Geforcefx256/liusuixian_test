## ADDED Requirements

### Requirement: Runtime workspace file APIs SHALL support explicit downloads within the current user-agent scope
The runtime SHALL expose a scoped workspace file download contract that allows an authenticated client to download tracked upload and output files for the current `user + agent` workspace.

#### Scenario: Client downloads an uploaded or output workspace file in scope
- **WHEN** an authenticated client issues a workspace file download request for a tracked file in the current `user + agent` scope
- **THEN** the runtime MUST return the corresponding file as an attachment response
- **AND** that response MUST include the authoritative download filename for that workspace file

#### Scenario: Runtime rejects download outside the current workspace scope
- **WHEN** a client attempts to download a workspace file that does not belong to the current authenticated `user + agent` scope
- **THEN** the runtime MUST reject that download request explicitly
- **AND** the runtime MUST NOT disclose file contents from another scope

#### Scenario: Missing file storage fails explicitly during download
- **WHEN** the runtime resolves a tracked workspace file entry but cannot read the corresponding stored file content
- **THEN** the download request MUST fail explicitly
- **AND** the runtime MUST NOT fabricate a synthetic attachment response that hides the storage failure
