## ADDED Requirements

### Requirement: Runtime workspace file APIs SHALL support constrained rename within the current user-agent scope
The runtime SHALL expose an explicit workspace file rename contract that allows the authenticated client to rename uploaded workspace files and path-addressed output workspace files within the current `user + agent` scope while preserving file identity.

#### Scenario: Client renames an uploaded workspace file in scope
- **WHEN** an authenticated client renames an uploaded workspace file in the current `user + agent` scope using a new basename with the same extension
- **THEN** the runtime MUST keep that file's stable identity fields unchanged
- **AND** the runtime MUST update the stored workspace file name and scoped upload path to the new basename

#### Scenario: Client renames a path-addressed output file in scope
- **WHEN** an authenticated client renames a writable output workspace file that has a stored `relativePath`
- **THEN** the runtime MUST preserve that file's existing parent directory within the scoped `outputs/` root
- **AND** the runtime MUST replace only the final basename segment with the new basename

#### Scenario: Runtime rejects rename outside the current workspace scope
- **WHEN** a client attempts to rename a workspace file that does not belong to the current authenticated `user + agent` scope
- **THEN** the runtime MUST reject that rename request
- **AND** the runtime MUST NOT mutate metadata or disk files belonging to another scope

### Requirement: Runtime workspace rename SHALL reject requests outside the v1 naming boundary
The runtime SHALL fail explicitly when a rename request attempts to exceed the v1 rename boundary instead of silently degrading or auto-correcting the request.

#### Scenario: Runtime rejects rename that changes directory or extension
- **WHEN** a client submits a rename target that contains a path separator or changes the file extension
- **THEN** the runtime MUST reject that rename request explicitly
- **AND** the runtime MUST leave the existing file metadata and disk file unchanged

#### Scenario: Runtime rejects case-only rename
- **WHEN** a client submits a rename target whose basename differs only by letter casing from the current basename
- **THEN** the runtime MUST reject that rename request explicitly
- **AND** the runtime MUST NOT perform a case-only rename as part of v1 behavior

#### Scenario: Runtime rejects legacy output rename
- **WHEN** a client attempts to rename an output workspace file that does not have a stored `relativePath`
- **THEN** the runtime MUST reject that rename request explicitly
- **AND** the runtime MUST continue to preserve that file's existing read compatibility behavior

#### Scenario: Runtime rejects rename target collision
- **WHEN** the rename target would collide with another tracked workspace file of the same kind in the same `user + agent` scope
- **THEN** the runtime MUST reject that rename request explicitly
- **AND** the runtime MUST NOT auto-generate an alternate target name

### Requirement: Runtime workspace rename SHALL keep metadata and storage consistent
The runtime SHALL keep workspace metadata and scoped file storage consistent across successful and failed rename attempts.

#### Scenario: Successful rename updates later metadata and open flows
- **WHEN** a workspace file rename succeeds
- **THEN** subsequent workspace metadata reads for that `user + agent` scope MUST expose the renamed file under its new path and file name
- **AND** later workspace open requests MUST resolve the file through that new path

#### Scenario: Persistence failure rolls the rename back to the old state
- **WHEN** the runtime has already renamed the disk file but cannot persist the updated workspace metadata
- **THEN** the rename request MUST fail explicitly
- **AND** the runtime MUST restore the previous tracked file path and metadata instead of returning a synthetic success result
