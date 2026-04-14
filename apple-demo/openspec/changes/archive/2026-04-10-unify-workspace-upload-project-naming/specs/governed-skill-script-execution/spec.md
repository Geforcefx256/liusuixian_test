## MODIFIED Requirements

### Requirement: Governed script invocation SHALL validate structured inputs and resolve scoped paths before execution
The runtime SHALL validate script inputs against manifest-declared schemas and resolve any scoped workspace or runtime paths before the script process starts.

#### Scenario: Invalid structured input fails before process start
- **WHEN** a caller omits a required field or provides a value that violates the script input schema
- **THEN** the runtime MUST reject that invocation before starting the script process
- **AND** the failure MUST identify that the problem originated in structured input validation

#### Scenario: Workspace and runtime paths are resolved by the runtime
- **WHEN** a script input param declares a `pathBase` role (e.g., `workspaceRoot`, `uploadDir`, `projectDir`, `tempDir`)
- **THEN** the runtime MUST resolve that field against the current scoped roots before invocation
- **AND** it MUST reject any path that escapes the allowed workspace or runtime boundary

### Requirement: Governed script results SHALL remain structured and workspace-aware
The runtime SHALL consume governed script results through a structured stdout contract so that artifacts and domain results remain compatible with the existing workbench result flow.

#### Scenario: Script-created workspace artifact is registered through structured output
- **WHEN** an approved script returns a structured artifact reference for a file under the current scoped `project/` root
- **THEN** the runtime MUST register that file as a workspace project entry
- **AND** it MUST preserve the resulting artifact metadata needed by the frontend to reopen that file

#### Scenario: Invalid structured output or non-zero exit stays explicit
- **WHEN** an approved script exits non-zero or emits stdout that does not match the declared structured result contract
- **THEN** the runtime MUST surface that invocation as an explicit failure
- **AND** it MUST NOT reinterpret the failure as a successful plain-text assistant result
