## ADDED Requirements

### Requirement: Migrated runtime package layout
The system SHALL provide a standalone runtime package at `apps/agent-backend` that contains the source code, runtime assets, configuration files, release scripts, extensions, tests, runtime working directories, and dist output required to run the migrated agent backend without depending on the legacy `ref_code/apps/agent-backend` layout.

#### Scenario: Source layout is complete after migration
- **WHEN** the migration is applied
- **THEN** `apps/agent-backend` MUST contain `src/`, `assets/`, `scripts/`, `extensions/`, `tests/`, `workspace/`, `data/`, and configuration files needed by the runtime

#### Scenario: Dist output remains service-local
- **WHEN** the migrated package is built
- **THEN** the compiled runtime MUST be emitted under `apps/agent-backend/dist`
- **AND** the runtime MUST be startable from that dist directory without reading files from `ref_code/apps/agent-backend`

### Requirement: Runtime behavior parity in the new package
The migrated package SHALL preserve the existing agent-backend product behavior, including authenticated agent execution, session persistence, planner/build phase handling, tool provider dispatch, dev log emission, memory management, and gateway/MCP integration.

#### Scenario: Core runtime routes remain available
- **WHEN** the migrated backend starts successfully
- **THEN** it MUST expose the same agent runtime route families for agents, runtime bootstrap, agent execution, files, memory, gateway tools, and dev logs

#### Scenario: Planner and build phases remain enforceable
- **WHEN** a workspace-agent session enters planning and then transitions to build
- **THEN** the migrated runtime MUST preserve plan persistence, approval state, and approved-skill enforcement before build execution proceeds

### Requirement: Skill and agent assets remain executable in source and dist modes
The migrated runtime SHALL package agent definitions, skill definitions, skill scripts, and related references so that `skill:skill` can load the intended `SKILL.md` content and any follow-up command execution can resolve the referenced script paths in both source and dist modes.

#### Scenario: Skill tool can load migrated SKILL content
- **WHEN** an execution requests a known skill through `skill:skill`
- **THEN** the migrated runtime MUST return the matching `SKILL.md` body from `apps/agent-backend/assets/**`

#### Scenario: Dist build rewrites runtime-sensitive skill paths
- **WHEN** the dist package is assembled
- **THEN** any source-path references embedded in migrated `SKILL.md` files MUST be rewritten to the dist layout expected by the released package

### Requirement: Product workspace and template dependencies remain valid
The migrated runtime SHALL preserve the original workspace-root design intent for local tools while moving frontend-owned template assets into `apps/web/public/templates/` for any skill flows that instruct users to use those templates.

#### Scenario: Local tools operate on the product workspace root
- **WHEN** local runtime tools inspect files or execute workspace-scoped commands
- **THEN** they MUST resolve paths relative to the migrated product workspace root rather than the legacy `ref_code/` tree

#### Scenario: CSV skill references the migrated frontend template
- **WHEN** a CSV-processing skill needs to direct a user to a template file
- **THEN** the runtime documentation and packaged assets MUST reference the migrated template path under `apps/web/public/templates/`

### Requirement: Browser proxying and service-side auth lookup remain distinct
The migrated system SHALL continue to support browser access through same-origin proxy routes while requiring the backend service to use an explicit configured auth base URL for server-to-server current-user lookup.

#### Scenario: Browser access uses same-origin API namespaces
- **WHEN** the frontend calls backend APIs in the migrated product
- **THEN** browser traffic MUST remain compatible with same-origin proxy access to `/agent/api/*` and `/web/api/*`

#### Scenario: Service auth lookup uses configured backend address
- **WHEN** the migrated agent backend validates the current user
- **THEN** it MUST call the configured web-backend base URL for `/web/api/auth/me` instead of assuming a browser-relative proxy path
