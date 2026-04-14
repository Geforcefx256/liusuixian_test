## MODIFIED Requirements

### Requirement: Skill and agent assets remain executable in source and dist modes
The migrated runtime SHALL package agent definitions, skill definitions, governed script manifests, Node-executable skill script entries, and related references so that runtime execution can resolve the intended canonical skill assets in both source and dist modes while exposing only the governed skill surface to agents and end users.

#### Scenario: Governed runtime surface resolves canonical skill assets and script manifests
- **WHEN** the runtime builds the available skill set for an agent
- **THEN** it MUST resolve execution against canonical skill assets packaged under `apps/agent-backend/assets/**`
- **AND** it MUST include only skills that are approved through the managed skill governance layer for that agent surface
- **AND** any executable automation for those skills MUST be derived from canonical governed script manifests rather than from free-form shell text in `SKILL.md`

#### Scenario: Skill tool denies unmanaged or unapproved skills
- **WHEN** an execution requests a skill that exists in canonical assets but is not approved in the governed surface for the current request
- **THEN** the runtime MUST deny the skill-tool load for that skill
- **AND** the runtime MUST avoid exposing the raw skill body through the governed execution path

#### Scenario: Dist build preserves governed skill execution
- **WHEN** the dist package is assembled and later executes an approved governed skill
- **THEN** any runtime-sensitive canonical skill references, governed script manifests, and Node-executable script entries MUST still resolve to the dist layout expected by the released package
- **AND** governed skill approval MUST continue to apply in dist mode

### Requirement: Runtime tool catalog SHALL NOT include `local:bash`
The runtime SHALL NOT register or expose a `local:bash` tool. The governed skill script execution path (`skill:exec`) replaces all need for arbitrary shell execution.

#### Scenario: Tool catalog does not include bash
- **WHEN** the runtime builds the tool catalog for any agent request
- **THEN** the catalog MUST NOT include `local:bash`
- **AND** no sandbox configuration or seatbelt profile MUST exist in the runtime

#### Scenario: Runtime config does not carry sandbox fields
- **WHEN** the runtime configuration is loaded
- **THEN** it MUST NOT contain `sandbox` configuration fields (backend, timeoutSeconds, cpuSeconds, memoryMb)
- **AND** `RUNTIME_SANDBOX_*` environment variable overrides MUST NOT be recognized

#### Scenario: Governed script tools remain available without bash
- **WHEN** the current governed skill surface contains approved script tools
- **THEN** the runtime MUST expose governed script tools through `skill:exec`
- **AND** it MUST NOT require operators to enable any form of `local:bash` for script execution

### Requirement: Runtime tool deny policy SHALL coexist with governed runtime surfaces
The system SHALL support a runtime tool deny list in addition to the governed skill and agent surfaces already enforced by the current repository.

#### Scenario: Denied runtime tools are excluded without removing governed skill metadata
- **WHEN** the runtime catalog is built with configured denied tools
- **THEN** denied tools MUST be excluded from tool catalog and invocation
- **AND** governed agent metadata and governed skill metadata MUST continue to be resolved through the current managed skill governance path

#### Scenario: Governed skill approval remains authoritative when deny list is empty
- **WHEN** no runtime tool deny entries are configured
- **THEN** the runtime MUST continue to enforce governed skill visibility and approval exactly through the managed skill governance layer
- **AND** the absence of denied tools MUST NOT broaden the governed skill surface beyond what the managed registry allows

#### Scenario: Disabled local filesystem search stays hidden through runtime deny policy
- **WHEN** the shipped runtime configuration places `local:search_in_files` in the runtime tool deny list
- **THEN** the runtime MUST exclude that local tool from catalog and invocation
- **AND** the local tool provider implementation MAY remain packaged for future re-enablement through configuration changes
