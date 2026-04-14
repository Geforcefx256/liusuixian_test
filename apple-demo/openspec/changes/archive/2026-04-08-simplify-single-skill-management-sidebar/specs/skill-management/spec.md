## ADDED Requirements

### Requirement: Skill management sidebar SHALL use summary-card navigation
The system SHALL render the left pane of the skill management page as a summary-card rail for all managed skill datasets. The rail MUST preserve skill selection behavior without rendering the legacy governance-list heading, search field, lifecycle filter, or draft/published counters.

#### Scenario: One managed skill shows a single summary card
- **WHEN** an administrator opens the skill management page and the managed skill dataset contains exactly one skill
- **THEN** the left pane MUST render a summary-card rail with exactly one skill summary card
- **AND** the left pane MUST NOT render the governance-list heading, search field, lifecycle filter, or draft/published counters

#### Scenario: Multi-skill datasets keep explicit selection through summary cards
- **WHEN** an administrator opens the skill management page and the managed skill dataset contains two or more skills
- **THEN** the left pane MUST render one clickable summary card per managed skill
- **AND** selecting a summary card MUST switch the right-side governance detail to the corresponding managed skill

### Requirement: Summary cards SHALL only expose lightweight governance state
The system SHALL keep the left summary cards focused on lightweight governance state. They MUST avoid repeating canonical identity and agent-binding metadata that are already available in the detail pane.

#### Scenario: Summary card titles use governed display name or explicit placeholder
- **WHEN** a managed skill is rendered in the left summary rail
- **THEN** the summary card title MUST use the governed `displayName`
- **AND** when `displayName` is empty the title MUST show `待填写用户可见名称`
- **AND** the UI MUST NOT silently fall back to `canonicalName`, `skillId`, or an empty title in that location

#### Scenario: Summary cards only show allowed governance fields
- **WHEN** a managed skill is rendered in the left summary rail
- **THEN** the summary card MUST include lifecycle state and Starter enabled state
- **AND** the summary card MUST show the localized intent-group label only if Starter is enabled for that skill
- **AND** the summary card MUST NOT include `canonicalName`, `skillId`, source agent, or bound-agent count
