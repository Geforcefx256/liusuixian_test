## MODIFIED Requirements

### Requirement: Workbench MUST initialize from backend agent metadata
The system SHALL load governed agent metadata from the backend so that the workbench shell, starter framework, and skill discovery surfaces are driven by managed skill policy rather than raw prototype constants or raw asset catalog order.

#### Scenario: Governed metadata populates the home shell
- **WHEN** the frontend loads the selected agent detail successfully
- **THEN** the workbench MUST use backend-provided governed agent identity and managed skill metadata to populate the home-stage header and starter framework

#### Scenario: Runtime bootstrap configures governed session behavior
- **WHEN** the frontend loads runtime bootstrap for the active agent
- **THEN** the frontend MUST use that bootstrap payload to initialize the session experience and governed runtime context
- **AND** the governed skill surface in the bootstrap MUST match the skills that can be executed for that agent surface

## ADDED Requirements

### Requirement: Workbench home stage SHALL project governed core-network starter groups
The workbench SHALL present governed starter entries for the active agent using the core-network task groups of planning, configuration authoring, data transformation, and verification.

#### Scenario: Home stage shows governed representative starter skills
- **WHEN** an authenticated user opens the workbench without an active session
- **THEN** the home stage MUST group starter entries by the governed core-network task groups
- **AND** each populated group MUST show at most one representative managed skill for the current user-visible agent surface

#### Scenario: Empty group falls back to governed discovery
- **WHEN** a core-network task group has no representative managed skill for the current surface
- **THEN** the home stage MUST render a governed discovery fallback for that group instead of fabricating a representative skill

### Requirement: Workbench skill discovery SHALL hide raw skill bodies from end users
The workbench SHALL let end users discover and use governed skills while restricting visibility to governed descriptions and starter metadata.

#### Scenario: Search shows governed skill descriptions only
- **WHEN** a user searches for available skills from the workbench
- **THEN** the search results MUST use the governed visible skill set for the current user and active agent
- **AND** each result MUST show governed descriptive metadata without exposing the raw `SKILL.md` body

#### Scenario: Hidden experimental skills do not appear in production discovery
- **WHEN** a skill is not visible on the production surface for the current user or agent
- **THEN** the workbench MUST exclude that skill from starter cards and default skill search results
