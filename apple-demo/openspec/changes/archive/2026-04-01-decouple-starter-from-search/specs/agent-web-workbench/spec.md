## MODIFIED Requirements

### Requirement: Workbench SHALL present governed starter skills with two-step selection

The workbench SHALL continue to project governed starter guidance for the active agent within the empty conversation shell, using a two-step selection model where the user first previews a skill's description and then confirms execution.

#### Scenario: Empty conversation shell shows governed starter groups with preview skills
- **WHEN** an authenticated user views the workbench with no persisted session selected or with an empty draft conversation
- **THEN** the conversation surface MUST show governed starter entries grouped by the supported task-group model for the active agent
- **AND** each non-empty starter group MUST show a preview list of up to 3 governed user-facing skill names
- **AND** each skill name in the preview list MUST be an independent clickable element

#### Scenario: Clicking a skill name expands its description within the card
- **WHEN** a user clicks a skill name inside a starter card
- **THEN** the workbench MUST expand that skill's description inline within the card
- **AND** the workbench MUST show a "开始使用" text link below the description
- **AND** the workbench MUST collapse any previously expanded skill (accordion behavior within the card)
- **AND** if the previously expanded skill is in a different card, that card MUST also collapse its expanded skill

#### Scenario: Global single-selection across all starter cards and search
- **WHEN** a skill is expanded in any starter card or in the search results
- **THEN** no other skill in any starter card or in the search results MUST remain expanded at the same time
- **AND** clicking the already-expanded skill MUST collapse it (toggle behavior)

#### Scenario: Clicking "开始使用" sends the skill prompt
- **WHEN** a user clicks the "开始使用" text link for an expanded skill
- **THEN** the workbench MUST emit the skill's `starterPrompt` for execution
- **AND** the workbench MUST clear the selected skill state after sending

#### Scenario: Empty starter group shows fallback
- **WHEN** a governed starter group has no managed skills for the current agent surface
- **THEN** the starter card MUST render an empty-state message instead of skill names
- **AND** the card MUST NOT respond to skill click interactions

#### Scenario: Starter cards do not interact with the search area
- **WHEN** a user clicks a skill name or expands a skill in a starter card
- **THEN** the workbench MUST NOT modify the search input value
- **AND** the workbench MUST NOT modify the search results
- **AND** the workbench MUST NOT change the expanded/collapsed state of the search area

### Requirement: Workbench SHALL provide an independent expanded search area

The "更多搜索" area SHALL operate independently from the starter cards, default to expanded, and provide global skill search without any starter-group filtering.

#### Scenario: Search area is expanded by default
- **WHEN** an authenticated user views the workbench empty conversation shell
- **THEN** the "更多搜索" area MUST be in its expanded state by default
- **AND** the search input MUST be empty

#### Scenario: Search area shows hot skills when no query is entered
- **WHEN** the search input is empty
- **THEN** the search area MUST display hot skill chips
- **AND** the search area MUST NOT display the full skill list

#### Scenario: Clicking a hot skill chip fills the search input
- **WHEN** a user clicks a hot skill chip
- **THEN** the workbench MUST set the skill name as the search input value
- **AND** the search results MUST be filtered by that value

#### Scenario: Search filters skills globally without group scoping
- **WHEN** a user types a search query or a hot skill chip fills the search input
- **THEN** the workbench MUST filter all visible skills by the search query
- **AND** the workbench MUST NOT limit results to any specific intent group
- **AND** the search results MUST be ordered by starter priority

#### Scenario: Search results support the same two-step selection as starter cards
- **WHEN** a user clicks a skill name in the search results
- **THEN** the workbench MUST expand that skill's description inline
- **AND** the workbench MUST show a "开始使用" text link below the description
- **AND** the workbench MUST collapse any expanded skill in the starter cards (global single-selection)

#### Scenario: Empty search results show suggestions
- **WHEN** a search query produces no matching skills
- **THEN** the search area MUST display an empty-state message
- **AND** the search area MUST display suggestion chips for alternative queries

#### Scenario: Clearing the search input returns to hot skills
- **WHEN** a user clears the search input (via the clear button or by deleting all text)
- **THEN** the search area MUST return to displaying hot skill chips
- **AND** the search results list MUST be hidden

## REMOVED Requirements

### Requirement: Skill discovery context (REMOVED)

The following behaviors are removed as part of this change:

- The `SkillDiscoveryContext` state and its associated `source`, `intentGroup`, and `representativeSkillId` fields.
- The "来自常用起点" discovery context banner in the search area.
- The `Starter 推荐` representative skill badge and top-pinned ordering in search results.
- The starter card click behavior that expands the search panel and sets a discovery context.
- The `StarterGroupView.skill` representative skill field.
