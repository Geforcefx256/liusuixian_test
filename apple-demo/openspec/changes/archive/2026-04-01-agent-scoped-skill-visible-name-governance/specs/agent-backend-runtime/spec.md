## MODIFIED Requirements

### Requirement: Runtime metadata SHALL expose governed skill surfaces
The runtime SHALL expose governed skill metadata to agent detail, bootstrap, and execution-planning surfaces so that runtime behavior matches managed skill policy for the current agent binding.

#### Scenario: Agent detail returns only governed visible skills
- **WHEN** the frontend or another client requests agent detail for a governed agent surface
- **THEN** the runtime MUST return only managed skills that are visible for that surface
- **AND** each returned skill MUST contain the governed user-visible name resolved for that agent surface rather than raw canonical skill identity

#### Scenario: Planner candidate skills follow governed approval
- **WHEN** the runtime selects candidate skills for planning or build execution
- **THEN** it MUST choose candidates from the governed visible skill set for the current request
- **AND** experimental or unbound skills MUST NOT appear as planner candidates for production users

#### Scenario: Completed execution metadata carries governed triggered skill name
- **WHEN** a run completes after resolving a governed managed skill for the current agent
- **THEN** the runtime MUST emit completion metadata that includes that agent surface's governed user-visible skill name for header rendering
- **AND** the runtime MUST NOT require the frontend to display the raw canonical skill name or `skillId` in user-visible execution summaries

### Requirement: Runtime SHALL expose configurable tool display names for user-visible execution surfaces
The runtime SHALL allow user-visible tool names to be configured independently from the underlying tool identifiers and SHALL use that configured mapping, together with governed agent-scoped skill names, when emitting execution metadata consumed by the workbench.

#### Scenario: Tool-started event prefers configured display name
- **WHEN** a tool invocation begins and the runtime emits a `tool.started` stream event
- **AND** the invoked tool has a configured display name for its full tool identifier such as `skill:read_asset`
- **THEN** the runtime MUST set `displayName` in that event to the configured user-visible name
- **AND** the runtime MUST NOT expose the raw normalized tool identifier in place of that configured name

#### Scenario: Skill-started event uses governed agent-scoped skill name
- **WHEN** a governed skill invocation begins for the current agent surface
- **THEN** the runtime MUST set `displayName` in the `tool.started` event to that agent binding's governed user-visible skill name
- **AND** the runtime MUST NOT emit the canonical skill name or `skillId` as the user-visible event label

#### Scenario: Tool-started event falls back for unmapped tools
- **WHEN** a tool invocation begins for a tool that does not have a configured display name
- **THEN** the runtime MUST still emit a `tool.started` event successfully
- **AND** the runtime MUST fall back to the existing normalized tool-name presentation rather than failing the run
