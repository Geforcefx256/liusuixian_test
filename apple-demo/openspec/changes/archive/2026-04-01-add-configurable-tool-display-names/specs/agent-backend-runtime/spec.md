## ADDED Requirements

### Requirement: Runtime SHALL expose configurable tool display names for user-visible execution surfaces
The runtime SHALL allow user-visible tool names to be configured independently from the underlying tool identifiers and SHALL use that configured mapping when emitting execution metadata consumed by the workbench.

#### Scenario: Tool-started event prefers configured display name
- **WHEN** a tool invocation begins and the runtime emits a `tool.started` stream event
- **AND** the invoked tool has a configured display name for its full tool identifier such as `skill:read_asset`
- **THEN** the runtime MUST set `displayName` in that event to the configured user-visible name
- **AND** the runtime MUST NOT expose the raw normalized tool identifier in place of that configured name

#### Scenario: Tool-started event falls back for unmapped tools
- **WHEN** a tool invocation begins for a tool that does not have a configured display name
- **THEN** the runtime MUST still emit a `tool.started` event successfully
- **AND** the runtime MUST fall back to the existing normalized tool-name presentation rather than failing the run

### Requirement: Runtime bootstrap SHALL publish tool display-name mappings for frontend summary rendering
The runtime SHALL publish the configured tool display-name mapping through runtime bootstrap so the frontend can render completed-turn tool summaries with the same naming policy used by streaming events.

#### Scenario: Bootstrap returns configured tool display-name map
- **WHEN** a client requests runtime bootstrap for an active agent
- **THEN** the bootstrap payload MUST include the runtime tool display-name mapping keyed by full tool identifier
- **AND** that mapping MUST be sufficient for the client to resolve names for built-in runtime tools such as `local:*` and `skill:*`

#### Scenario: Bootstrap keeps user-visible naming stable across the same runtime config
- **WHEN** the runtime configuration has not changed between bootstrap and later tool execution
- **THEN** the tool display names emitted in `tool.started` events MUST remain consistent with the names published through bootstrap
- **AND** the runtime MUST avoid requiring the frontend to hardcode an alternate naming table for the same tool set
