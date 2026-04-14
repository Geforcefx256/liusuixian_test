## ADDED Requirements

### Requirement: Workbench SHALL render one shared notes field for pending select questions
The workbench SHALL render exactly one optional `notes` input for each pending question interaction that contains a `select` answer path so users can submit supplementary context without changing the structured primary answer.

#### Scenario: Pending select question shows one optional notes input
- **WHEN** the active session contains a pending question interaction with at least one `select` field
- **THEN** the pending question card MUST render exactly one optional `notes` input in addition to the primary answer controls
- **AND** the workbench MUST NOT render multiple independent free-text supplement fields for the same pending interaction

#### Scenario: Notes submission stays separate from the primary answer
- **WHEN** the user submits a pending select question with both a selected answer and a `notes` value
- **THEN** the workbench MUST submit the selected answer as the structured primary answer
- **AND** the workbench MUST submit `notes` as supplementary context rather than as a replacement for the selected option

### Requirement: Workbench SHALL render degraded question interactions with preserved reference context
The workbench SHALL render degraded question interactions as dedicated pending-question cards that preserve the failed question's prompt and any extracted reference option text so the user can continue through the same interaction UI instead of switching back to ordinary chat submission.

#### Scenario: Degraded question card shows reason and reference options
- **WHEN** the active session contains a degraded pending question interaction
- **THEN** the pending question card MUST display a user-readable explanation that structured question collection failed
- **AND** the card MUST continue to show the original prompt
- **AND** the card MUST show any backend-provided reference option text as non-clickable guidance for the user's manual answer

#### Scenario: Degraded question card submits answer plus notes through reply flow
- **WHEN** the user submits a degraded pending question interaction
- **THEN** the workbench MUST send the required text `answer` and any optional `notes` value through the dedicated interaction-reply path
- **AND** the frontend MUST NOT dispatch that degraded answer as a generic `/agent/run` chat message
