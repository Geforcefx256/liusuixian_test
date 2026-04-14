## ADDED Requirements

### Requirement: Runtime migration SHALL preserve the current newui frontend contract
The system SHALL migrate `agent-V2-base` backend capabilities into `apps/agent-backend` without breaking the current `newui` frontend contract that is already consumed by `apps/web`.

#### Scenario: Workspace APIs remain available after backend capability migration
- **WHEN** the migrated `apps/agent-backend` starts successfully
- **THEN** it MUST continue to expose the current workspace-related endpoints used by `apps/web`
- **AND** the runtime MUST continue to return workspace payloads in the `tasks -> groups -> files` structure expected by the current workbench

#### Scenario: Stream and terminal message contracts remain frontend-compatible
- **WHEN** the current `newui` frontend invokes the migrated runtime through `/agent/api/agent/run`
- **THEN** the runtime MUST continue to emit stream events compatible with the current frontend conversation flow
- **AND** terminal results and persisted session messages MUST preserve the structured `protocol`, `domainResult`, `protocolState`, and runtime failure payloads expected by the current workbench

### Requirement: Runtime migration SHALL preserve the current project auth context
The system SHALL keep `apps/agent-backend` aligned with the current repository authentication and authorization context instead of adopting the source repository's reduced auth lookup model.

#### Scenario: Current-user lookup preserves role-aware auth context
- **WHEN** the migrated agent backend resolves the current authenticated user
- **THEN** it MUST remain compatible with the current repository auth response shape that includes role-aware user context
- **AND** backend migration MUST NOT require the runtime to fall back to a `userId`-only auth contract

#### Scenario: Admin-only routes continue to rely on the current auth semantics
- **WHEN** an administrator accesses managed skill administration routes after the migration
- **THEN** the runtime MUST continue to enforce authorization through the current project `requireUser` and `requireAdmin` semantics
- **AND** the migration MUST NOT remove or degrade the existing admin skill management route family

### Requirement: Runtime devlogs SHALL support backend file persistence without requiring frontend log UI
The system SHALL add devlog file persistence and redaction to `apps/agent-backend` while keeping log persistence independent from any migrated frontend log-view experience.

#### Scenario: Devlogs are written to redacted JSONL files
- **WHEN** file-based runtime logging is enabled for the migrated backend
- **THEN** the runtime MUST append devlog entries to service-side JSONL files
- **AND** the runtime MUST apply configured sensitive-data redaction before those entries are written to disk

#### Scenario: Log persistence does not require log-view frontend assets
- **WHEN** the backend migration is applied
- **THEN** devlog file persistence MUST work without introducing a dedicated frontend log-view page or frontend log-view runtime into the current repository

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

#### Scenario: Deleted gateway and MCP transform tools do not reappear through shipped defaults
- **WHEN** the shipped gateway and MCP configuration files omit `transform_rows` from their enabled server tool lists
- **THEN** `gateway:local:transform_rows` and `mcp:default:transform_rows` MUST NOT appear in runtime bootstrap or runtime catalog payloads
- **AND** the runtime MUST NOT rely on default fallback configuration that would silently restore those deleted tools
