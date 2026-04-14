## ADDED Requirements

### Requirement: Runtime SHALL expose a sandboxed `bash` execution contract for the current workspace
The runtime SHALL expose a model-facing `bash` execution contract that runs against the current authenticated `user + agent` workspace using path-based arguments rather than opaque file handles.

#### Scenario: Bash accepts workspace and runtime paths as explicit inputs
- **WHEN** a governed skill or model-invoked command needs to reference a user workspace file or a runtime reference file
- **THEN** the `bash` contract MUST allow explicit path-based arguments for files under the current workspace mount and the read-only runtime mount
- **AND** the contract MUST NOT require `@file:<fileKey>` or other opaque file-handle syntax

#### Scenario: Bash output contract remains workspace-scoped
- **WHEN** a `bash` command produces final or intermediate files
- **THEN** the command contract MUST direct those writes into the current workspace writable mounts
- **AND** the runtime MUST preserve enough structured output metadata for later workspace opening or follow-up processing

### Requirement: Bash sandbox mounts SHALL enforce read-only inputs and writable outputs
The runtime SHALL execute `bash` inside a sandbox that exposes only the governed runtime mount and the current scoped workspace mounts with fixed read/write permissions.

#### Scenario: Runtime assets and uploaded inputs are read-only
- **WHEN** a `bash` command runs inside the sandbox
- **THEN** governed runtime assets and reference files MUST be mounted read-only
- **AND** user-uploaded files under the scoped `uploads/` root MUST also be mounted read-only

#### Scenario: Outputs and intermediate files are writable only inside the current workspace
- **WHEN** a `bash` command writes generated files
- **THEN** it MUST be able to write only to the scoped writable workspace mounts such as `outputs/` and `temp/`
- **AND** attempts to write to read-only mounts or to paths outside the mounted workspace MUST fail explicitly

#### Scenario: Runtime references can be read while results still land in the workspace
- **WHEN** a `bash` command reads a reference file under the read-only runtime mount
- **THEN** that read MUST succeed without granting write access to the runtime mount
- **AND** any generated result files MUST still land under the current workspace writable mounts

### Requirement: Bash sandbox SHALL isolate host resources and bound execution
The runtime SHALL isolate `bash` execution from host resources outside the governed mounts and SHALL enforce bounded execution.

#### Scenario: Network access is disabled inside the sandbox
- **WHEN** a `bash` command attempts outbound network access from inside the sandbox
- **THEN** that access MUST be blocked
- **AND** the command failure MUST surface explicitly rather than silently falling back

#### Scenario: Host filesystem outside the mounted roots is inaccessible
- **WHEN** a `bash` command attempts to read or write a path outside the mounted runtime and workspace roots
- **THEN** the sandbox MUST deny that access
- **AND** the runtime MUST avoid exposing host filesystem paths as an alternate fallback

#### Scenario: Resource limits are enforced for command execution
- **WHEN** a `bash` command exceeds configured execution time, CPU budget, or memory budget
- **THEN** the runtime MUST terminate that command
- **AND** the resulting failure MUST surface as an explicit runtime error
