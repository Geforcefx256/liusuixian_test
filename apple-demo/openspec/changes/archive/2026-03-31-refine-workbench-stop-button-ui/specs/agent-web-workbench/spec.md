## ADDED Requirements

### Requirement: Workbench conversation composer SHALL keep running feedback subordinate to the stop action
The authenticated workbench SHALL keep generic run-in-progress feedback visually quiet in the conversation composer so the active interruption action remains the clearest control during a running turn.

#### Scenario: Active run keeps send button label stable while disabled
- **WHEN** the selected session has an active run and the conversation composer is visible
- **THEN** the send button MUST remain disabled
- **AND** the send button MUST keep its resting send label instead of switching to a prominent processing label

#### Scenario: Stop remains the explicit interruption affordance during a run
- **WHEN** the selected session has an active run whose stop control is available
- **THEN** the composer MUST render stop as an inline action beside the send control
- **AND** the stop control MUST remain visually distinct from the primary send CTA without implying irreversible deletion

### Requirement: Workbench stop-pending feedback SHALL stay inside the stop control
The authenticated workbench SHALL present stop-pending feedback as a local inline control state rather than as a stronger composer-level or page-level processing surface.

#### Scenario: Stop request shows inline spinner state without extra status bar
- **WHEN** the user requests stop for the current active run and the cancel request is still pending
- **THEN** the stop control MUST remain visible in place and show an inline pending indicator with the stop-pending label
- **AND** the workbench MUST NOT introduce an additional composer-level banner or global status bar solely to represent that pending stop request

#### Scenario: Stop-pending state remains width-stable
- **WHEN** the stop control transitions between its resting label and its stop-pending label
- **THEN** the composer action row MUST remain visually stable without noticeable control-layout shift
