## ADDED Requirements

### Requirement: Workbench SHALL render awaiting-question turns with readable assistant bubble summaries
The workbench SHALL render the assistant bubble for an awaiting-question turn by using the backend-provided readable summary text while keeping the pending-question card as the authoritative structured interaction surface for the same turn.

#### Scenario: Awaiting-question turn shows readable assistant summary plus structured card
- **WHEN** a completed run returns `awaiting-interaction` output for a pending question
- **THEN** the workbench MUST render the assistant bubble body with the backend-provided summary text for that turn
- **AND** the workbench MUST continue to render the pending-question card for the same interaction as the authoritative structured input UI

#### Scenario: Summary bubble does not duplicate option lists or degraded diagnostics
- **WHEN** the pending question interaction contains select options, degraded reference options, or a degraded failure explanation
- **THEN** the assistant bubble MUST remain a concise summary surface
- **AND** the workbench MUST keep detailed options and degraded diagnostics inside the pending-question card rather than duplicating them into the assistant bubble

#### Scenario: Reload preserves the same awaiting-question summary bubble
- **WHEN** the user reloads or reopens a session that already contains a persisted awaiting-question assistant message
- **THEN** the workbench MUST render the same readable assistant summary text from canonical session history
- **AND** the frontend MUST NOT require client-only recomputation from tool traces or transient interaction state to preserve that bubble
