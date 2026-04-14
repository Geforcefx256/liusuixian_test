## ADDED Requirements

### Requirement: Workbench MUST present a consistent Agent identity across home and active session states
The system SHALL render a consistent Agent identity language in the phase 1 Vue workbench so that users can recognize the active Agent before and after entering a session.

#### Scenario: Home stage shows the active Agent identity with product-aligned styling
- **WHEN** an authenticated user opens the workbench without an active session
- **THEN** the home stage MUST display the active Agent using a shared badge, title, subtitle, and status treatment aligned with `index-v10.html`
- **AND** the displayed title and subtitle MUST continue to be derived from backend-provided Agent metadata

#### Scenario: Active session retains a visible Agent identity bar
- **WHEN** the user creates or opens an agent session
- **THEN** the conversation area MUST display a persistent Agent identity bar above the message list
- **AND** that bar MUST preserve the same Agent title/subtitle semantics used by the home stage

### Requirement: Phase 1 workbench surfaces MUST align visually without expanding workspace scope
The system SHALL align the visual treatment of the workbench shell, conversation input surfaces, and workspace context panel with the established `index-v10.html` Agent language while keeping the existing phase 1 lightweight workspace behavior unchanged.

#### Scenario: Home and conversation composers use a shared visual language
- **WHEN** the user views the home-stage composer and the active-session composer
- **THEN** both composers MUST use consistent input shell, spacing, and action emphasis patterns
- **AND** the change MUST NOT introduce new composer actions or alter prompt submission behavior

#### Scenario: Workspace context remains lightweight after visual alignment
- **WHEN** the user views the right-side workspace context area after this change
- **THEN** the panel MUST present Agent information, task status, and uploaded files using a workbench-aligned side-panel style
- **AND** the panel MUST NOT introduce file preview, editing, table, or template-management behavior as part of this change
