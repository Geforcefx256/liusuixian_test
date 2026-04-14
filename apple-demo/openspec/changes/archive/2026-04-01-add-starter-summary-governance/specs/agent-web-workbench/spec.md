## MODIFIED Requirements

### Requirement: Workbench SHALL preserve governed starter affordances inside the empty conversation shell
The workbench SHALL continue to project governed starter guidance for the active agent within the empty conversation shell, and starter details SHALL use governed summary metadata with a stable action area suitable for longer Chinese content instead of treating the description and action as one truncation block.

#### Scenario: Empty conversation shell shows governed starter groups with selectable preview skills
- **WHEN** an authenticated user views the workbench with no persisted session selected or with an empty draft conversation
- **THEN** the conversation surface MUST show governed starter entries grouped by the supported task-group model for the active agent
- **AND** each non-empty starter group MUST show a preview list of up to 3 governed user-facing skill names
- **AND** each skill name in the preview list MUST be an independent clickable element that can reveal starter details inline within the group card

#### Scenario: Skill selection reveals governed summary with a dedicated starter action row
- **WHEN** a user clicks a skill name inside a starter card
- **THEN** the workbench MUST expand that skill's starter detail inline within the card
- **AND** the starter detail MUST show the governed starter summary when it exists, otherwise it MUST fall back to the governed description for that skill
- **AND** the starter detail MUST show a dedicated starter action control in an action row separate from the summary text
- **AND** the workbench MUST collapse any previously expanded skill across starter cards and search surfaces

#### Scenario: Long starter copy does not clip the starter action
- **WHEN** the governed starter summary or fallback description is longer than the available inline space in the starter detail
- **THEN** the workbench MUST constrain the copy independently from the action row
- **AND** the starter action control MUST remain fully visible and interactive on supported empty-shell widths
- **AND** the workbench MUST NOT rely on a single truncation container that clips both the copy and the action

#### Scenario: Starter action sends the governed starter prompt
- **WHEN** a user activates the starter action control for an expanded skill
- **THEN** the workbench MUST send that skill's governed `starterPrompt` for execution
- **AND** the workbench MUST clear the selected starter skill state after sending

#### Scenario: Empty starter group shows fallback
- **WHEN** a governed starter group has no managed skills for the current agent surface
- **THEN** the empty conversation shell MUST render a governed empty-state fallback instead of fabricating skill entries
