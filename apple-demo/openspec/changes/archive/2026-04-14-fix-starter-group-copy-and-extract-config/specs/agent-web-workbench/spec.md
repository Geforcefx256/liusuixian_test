## MODIFIED Requirements

### Requirement: Workbench SHALL present governed starter skills with two-step selection
The workbench SHALL continue to project governed starter guidance for the active agent within the empty conversation shell, using a two-step selection model where the user first expands a skill's starter summary and then confirms execution, while allowing the user to inspect the starter summary through a desktop-only hover help surface.

#### Scenario: Empty conversation shell shows governed starter groups with preview skills
- **WHEN** an authenticated user views the workbench with no persisted session selected or with an empty draft conversation
- **THEN** the conversation surface MUST show governed starter entries grouped by the supported task-group model for the active agent
- **AND** each non-empty starter group MUST show a preview list of up to 3 governed user-facing skill names

#### Scenario: Clicking a skill name expands its starter summary within the card
- **WHEN** a user clicks a skill name inside a starter card
- **THEN** the workbench MUST expand that skill's starter summary inline within the card

#### Scenario: Hovering the `i` trigger shows the starter summary on desktop
- **WHEN** a user hovers the `i` trigger in a starter card on a desktop viewport
- **AND** the help card MUST display the governed user-facing skill name and the governed starter summary for that skill

#### Scenario: Starter card hover help placement follows column position
- **WHEN** the workbench shows a starter-skill hover help card in the desktop starter grid
- **THEN** the help card MUST use the fixed placement rule for the current three-column starter layout
- **AND** the first starter column MUST place the card to the right of the trigger
- **AND** the second starter column MUST place the card below the trigger
- **AND** the third starter column MUST place the card to the left of the trigger

#### Scenario: Long starter summary truncates with read-more affordance
- **WHEN** the starter summary is long enough to exceed the hover help card's intended reading density

#### Scenario: Global single-selection across all starter cards and search
- **WHEN** a skill is expanded in any starter card or in the search results
- **THEN** no other skill in any starter card or in the search results MUST remain expanded at the same time

#### Scenario: Confirming a skill sends its starter prompt
- **THEN** the workbench MUST emit the skill's `starterPrompt` for execution
- **AND** the workbench MUST clear the selected skill state after sending

#### Scenario: Empty starter group shows no content
- **WHEN** a governed starter group has no managed skills for the current agent surface
- **THEN** the starter card in ConversationPane MUST render nothing in place of the skill list
- **AND** the card MUST NOT render any empty-state text or message
- **AND** the card MUST NOT respond to skill click interactions

#### Scenario: Starter cards do not interact with the search area
- **WHEN** a user clicks a skill name, opens a hover help card, or expands a skill in a starter card
- **THEN** the workbench MUST NOT modify the search input value
- **AND** the workbench MUST NOT modify the search results
- **AND** the workbench MUST NOT change the expanded/collapsed state of the search area
