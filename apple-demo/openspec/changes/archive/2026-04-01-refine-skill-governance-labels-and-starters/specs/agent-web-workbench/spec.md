## MODIFIED Requirements

### Requirement: Workbench MUST initialize from backend agent metadata
The system SHALL load governed agent metadata from the backend so that the workbench shell, starter framework, skill discovery surfaces, and user-visible Agent naming are driven by backend-provided Agent metadata rather than raw prototype constants, raw asset catalog order, or frontend hardcoded naming.

#### Scenario: Governed metadata populates the home shell
- **WHEN** the frontend loads the selected agent detail successfully
- **THEN** the workbench MUST use backend-provided governed agent identity and managed skill metadata to populate the home-stage header and starter framework

#### Scenario: Runtime bootstrap configures governed session behavior
- **WHEN** the frontend loads runtime bootstrap for the active agent
- **THEN** the frontend MUST use that bootstrap payload to initialize the session experience and governed runtime context
- **AND** the governed skill surface in the bootstrap MUST match the skills that can be executed for that agent surface

#### Scenario: User-visible Agent name is not frontend-hardcoded
- **WHEN** the workbench renders the current Agent identity in a user-visible surface
- **THEN** the displayed Agent title MUST resolve from backend-provided Agent metadata
- **AND** the frontend MUST NOT replace that title with a frontend-hardcoded name for the same agent

#### Scenario: Governed skill update refreshes active workbench metadata
- **WHEN** an administrator successfully saves managed skill governance for the currently selected agent inside the same workbench shell
- **THEN** the frontend MUST refresh the governed agent metadata used by starter and search surfaces
- **AND** the workbench MUST NOT continue rendering stale governed skill names for that active agent until a manual page reload

### Requirement: Workbench skill discovery SHALL hide raw skill bodies from end users
The workbench SHALL let end users discover and use governed skills while restricting visibility to governed descriptions and starter metadata.

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

### Requirement: Workbench SHALL preserve governed starter affordances inside the empty conversation shell
The workbench SHALL continue to project governed starter guidance for the active agent, but it SHALL do so within the empty conversation shell instead of a separate home-stage page mode.

#### Scenario: Empty conversation shell shows governed representative starter groups
- **WHEN** an authenticated user views the workbench with no persisted session selected or with an empty draft conversation
- **THEN** the conversation surface MUST be able to show governed starter entries grouped by the supported task-group model for the active agent
- **AND** each non-empty starter group MUST show a preview list of governed user-facing skill names for that group
- **AND** the starter card MUST keep a single card-level click action rather than exposing each previewed skill name as its own clickable control

#### Scenario: Empty starter group falls back to governed discovery
- **WHEN** a governed starter group has no representative managed skill for the current agent surface
- **THEN** the empty conversation shell MUST render a governed discovery fallback instead of fabricating a representative entry

#### Scenario: Starter cards omit redundant action copy
- **WHEN** a starter group already uses the full card as its interactive surface
- **THEN** the empty conversation shell MUST NOT require an additional trailing action label such as `立即开始`
- **AND** the governed skill-name preview MUST remain the primary informational cue inside that card
