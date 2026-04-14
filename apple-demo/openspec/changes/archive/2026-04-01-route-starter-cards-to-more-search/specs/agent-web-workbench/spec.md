## MODIFIED Requirements

### Requirement: Workbench SHALL preserve governed starter affordances inside the empty conversation shell
The workbench SHALL continue to project governed starter guidance for the active agent, but it SHALL do so within the empty conversation shell instead of a separate home-stage page mode.

#### Scenario: Empty conversation shell shows governed representative starter groups
- **WHEN** an authenticated user views the workbench with no persisted session selected or with an empty draft conversation
- **THEN** the conversation surface MUST be able to show governed starter entries grouped by the supported task-group model for the active agent
- **AND** each non-empty starter group MUST show a preview list of governed user-facing skill names for that group
- **AND** the starter card MUST keep a single card-level click action rather than exposing each previewed skill name as its own clickable control

#### Scenario: Starter selection opens governed discovery instead of mutating the composer
- **WHEN** a user clicks a starter card from the empty conversation shell
- **THEN** the workbench MUST expand or reveal the governed `更多搜索` discovery area for that shell
- **AND** the workbench MUST NOT prefill the composer body with a generated `请帮我使用...` style prompt solely because the starter card was clicked

#### Scenario: Starter selection applies group-focused discovery context
- **WHEN** a user clicks a starter card for a governed intent group
- **THEN** the workbench MUST focus discovery results on that starter card's intent group even if the search input remains empty
- **AND** the search input MUST remain available for the user to refine the discovery results manually
- **AND** the workbench MUST present visible feedback that discovery is currently scoped from the selected starter group

#### Scenario: Representative starter skill remains emphasized inside discovery
- **WHEN** a starter group has a representative governed starter skill and the user enters discovery from that starter card
- **THEN** the workbench MUST emphasize that representative skill inside the `更多搜索` area
- **AND** the workbench MUST continue to show other governed skills from the same group so the user can compare alternatives before selecting one

#### Scenario: Empty starter group falls back to governed discovery
- **WHEN** a governed starter group has no representative managed skill for the current agent surface
- **THEN** the empty conversation shell MUST render a governed discovery fallback instead of fabricating a representative entry

#### Scenario: Starter cards omit redundant action copy
- **WHEN** a starter group already uses the full card as its interactive surface
- **THEN** the empty conversation shell MUST NOT require an additional trailing action label such as `立即开始`
- **AND** the governed skill-name preview MUST remain the primary informational cue inside that card
