## ADDED Requirements

### Requirement: Workbench assistant headers SHALL use runtime-configured tool display names
The workbench SHALL use the runtime-provided tool display-name mapping when rendering assistant header tool labels so that in-flight tool calls and completed-turn summaries present the same user-visible names.

#### Scenario: In-flight header shows configured tool display name
- **WHEN** the workbench receives a `tool.started` event for the active assistant turn
- **THEN** the in-flight assistant header MUST use the event's configured `displayName`
- **AND** the header MUST NOT recompute or replace that configured name with a frontend-hardcoded alias

#### Scenario: Completed summary reuses bootstrap tool display-name mapping
- **WHEN** a completed run reports tool metrics for one or more invoked tools
- **AND** runtime bootstrap has provided a display-name mapping for those tool identifiers
- **THEN** the completed assistant header summary MUST use the configured display names from that mapping
- **AND** the completed summary MUST present the same user-visible names that were used for the corresponding in-flight tool calls

#### Scenario: Completed summary falls back without configured mapping
- **WHEN** a completed run reports a tool identifier that is not present in the runtime bootstrap display-name mapping
- **THEN** the completed assistant header MUST still render a compact tool summary
- **AND** the workbench MUST fall back to the existing normalized tool-name display instead of hiding the tool reference entirely
