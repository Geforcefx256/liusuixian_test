## ADDED Requirements

### Requirement: Canonical skill packages SHALL declare governed script manifests in `SCRIPTS.yaml`
The system SHALL allow a canonical repo-owned skill package to declare executable scripts in a machine-readable `SCRIPTS.yaml` manifest that is separate from `SKILL.md` and can be validated without parsing shell instructions from skill prose.

#### Scenario: Approved skill package exposes script manifest metadata
- **WHEN** the runtime loads a canonical approved skill package that includes a `SCRIPTS.yaml` manifest
- **THEN** it MUST read template ids, descriptions, script entry references, param schemas, and timeout configs from that manifest
- **AND** it MUST continue to treat `SKILL.md` as human/model-readable guidance rather than as an executable command template

#### Scenario: Invalid script manifest entry is rejected explicitly
- **WHEN** a canonical skill package contains a script manifest entry with a missing id, invalid param schema, script path containing `..`, or unresolved entry path
- **THEN** the runtime MUST exclude that template from governed execution surfaces
- **AND** it MUST NOT fabricate a fallback executable command from `SKILL.md` or other free-form text

### Requirement: Governed skill scripts SHALL be exposed through a single `skill:exec` tool
The runtime SHALL expose all approved governed skill script templates through one `skill:exec` tool rather than registering separate tools per script.

#### Scenario: `skill:exec` tool description remains stable and does not enumerate templates
- **WHEN** the runtime builds a tool catalog for a governed agent request
- **THEN** the `skill:exec` tool description MUST describe only the stable invocation contract for `{ skillName, templateId, args }`
- **AND** it MUST NOT embed per-template dynamic metadata from approved or unapproved skills into that description
- **AND** template discoverability for the model MUST come from approved skill guidance loaded through the `skill` tool rather than from `skill:exec` description text

#### Scenario: Template invocation dispatches to the correct script
- **WHEN** the model invokes `skill:exec` with `{ skillName, templateId, args }`
- **THEN** the runtime MUST resolve the skill by governed approval, find the matching template by id, validate args against the declared param schema, and execute the script
- **AND** it MUST return `TOOL_NOT_FOUND` if the template id does not exist on the resolved skill
- **AND** it MUST return `TOOL_DENIED` if the skill is not approved for the current governed surface

### Requirement: Governed skill scripts SHALL execute through fixed Node entrypoints without shell composition
The runtime SHALL execute approved skill scripts through a fixed Node runtime contract that does not allow the model to compose arbitrary shell commands.

#### Scenario: Runtime owns the executable command and process settings
- **WHEN** an approved script template is invoked
- **THEN** the runtime MUST choose the Node executable, resolved script entry, working directory, timeout, and environment for that invocation
- **AND** the invocation contract MUST NOT allow the caller to override those process settings with arbitrary `command`, `cwd`, `env`, or shell text

#### Scenario: Non-Node-executable script entries are not invoked
- **WHEN** a script manifest entry does not resolve to a Node-executable runtime asset in the current source or dist layout
- **THEN** the runtime MUST reject that script entry for invocation
- **AND** it MUST surface that failure explicitly rather than silently falling back to a shell-based launcher

### Requirement: Governed script invocation SHALL validate structured inputs and resolve scoped paths before execution
The runtime SHALL validate script inputs against manifest-declared schemas and resolve any scoped workspace or runtime paths before the script process starts.

#### Scenario: Invalid structured input fails before process start
- **WHEN** a caller omits a required field or provides a value that violates the script input schema
- **THEN** the runtime MUST reject that invocation before starting the script process
- **AND** the failure MUST identify that the problem originated in structured input validation

#### Scenario: Workspace and runtime paths are resolved by the runtime
- **WHEN** a script input param declares a `pathBase` role (e.g., `workspaceRoot`, `uploadsDir`, `outputsDir`, `tempDir`)
- **THEN** the runtime MUST resolve that field against the current scoped roots before invocation
- **AND** it MUST reject any path that escapes the allowed workspace or runtime boundary

### Requirement: Governed script results SHALL remain structured and workspace-aware
The runtime SHALL consume governed script results through a structured stdout contract so that artifacts and domain results remain compatible with the existing workbench result flow.

#### Scenario: Script-created workspace artifact is registered through structured output
- **WHEN** an approved script returns a structured artifact reference for a file under the current scoped `outputs/` root
- **THEN** the runtime MUST register that file as a workspace output entry
- **AND** it MUST preserve the resulting artifact metadata needed by the frontend to reopen that file

#### Scenario: Invalid structured output or non-zero exit stays explicit
- **WHEN** an approved script exits non-zero or emits stdout that does not match the declared structured result contract
- **THEN** the runtime MUST surface that invocation as an explicit failure
- **AND** it MUST NOT reinterpret the failure as a successful plain-text assistant result
