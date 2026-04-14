## MODIFIED Requirements

### Requirement: Workbench skill discovery SHALL hide raw skill bodies from end users
The workbench SHALL let end users discover and use governed skills while restricting visibility to governed descriptions and agent-scoped user-visible skill names.

#### Scenario: Search shows governed skill descriptions only
- **WHEN** a user searches for available skills from the workbench
- **THEN** the search results MUST use the governed visible skill set for the current user and active agent
- **AND** each result MUST show the governed skill name and descriptive metadata without exposing the raw `SKILL.md` body

#### Scenario: Hidden experimental skills do not appear in production discovery
- **WHEN** a skill is not visible on the production surface for the current user or agent
- **THEN** the workbench MUST exclude that skill from starter cards and default skill search results

#### Scenario: Hot skills use governed display names
- **WHEN** the workbench shows the default `热门技能` suggestions with no active search query
- **THEN** each suggestion MUST use the governed user-facing skill name for the current agent surface
- **AND** the workbench MUST NOT fall back to rendering the raw skill id as a normal display label

### Requirement: Workbench assistant headers SHALL use runtime-configured tool display names
The workbench SHALL use the runtime-provided tool display-name mapping and governed skill display metadata when rendering assistant header labels so that in-flight tool calls and completed-turn summaries present the same user-visible names for the current agent surface.

#### Scenario: In-flight header shows configured tool display name
- **WHEN** the workbench receives a `tool.started` event for the active assistant turn
- **THEN** the in-flight assistant header MUST use the event's configured `displayName`
- **AND** the header MUST NOT recompute or replace that configured name with a frontend-hardcoded alias

#### Scenario: Completed summary reuses bootstrap tool display-name mapping
- **WHEN** a completed run reports tool metrics for one or more invoked tools
- **AND** runtime bootstrap has provided a display-name mapping for those tool identifiers
- **THEN** the completed assistant header summary MUST use the configured display names from that mapping
- **AND** the completed summary MUST present the same user-visible names that were used for the corresponding in-flight tool calls

#### Scenario: Skill-triggered summary uses governed user-visible skill name
- **WHEN** a completed run reports that a managed skill was triggered for the active agent surface
- **THEN** the completed assistant header MUST render the `Skill:` mechanism word together with that governed user-visible skill name
- **AND** the workbench MUST NOT display the raw canonical skill name or `skillId` in that user-visible summary

#### Scenario: Completed summary falls back without configured mapping
- **WHEN** a completed run reports a tool identifier that is not present in the runtime bootstrap display-name mapping
- **THEN** the completed assistant header MUST still render a compact tool summary
- **AND** the workbench MUST fall back to the existing normalized tool-name display instead of hiding the tool reference entirely
