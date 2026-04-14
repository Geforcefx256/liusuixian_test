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

### Requirement: Workbench MUST present a consistent Agent identity across home and active session states
The system SHALL render a consistent Agent identity language in the phase 1 Vue workbench so that users can recognize the active Agent before and after entering a session, using a shared Agent badge or icon treatment, title, subtitle, and status semantics aligned with `index-v10.html`.

#### Scenario: Home stage shows the active Agent identity with product-aligned styling
- **WHEN** an authenticated user opens the workbench without an active session
- **THEN** the home stage MUST display the active Agent using a shared badge or icon treatment, title, subtitle, and status treatment aligned with `index-v10.html`
- **AND** the displayed title and subtitle MUST continue to be derived from backend-provided Agent metadata

#### Scenario: Active session retains a visible Agent identity bar
- **WHEN** the user creates or opens an agent session
- **THEN** the conversation area MUST display a persistent Agent identity bar above the message list
- **AND** that bar MUST preserve the same Agent badge or icon treatment and title or subtitle semantics used by the home stage
- **AND** the frontend MUST refine the existing Agent bar rather than requiring a second stacked title bar for the same session surface

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

#### Scenario: Workspace context uses the same Agent title priority
- **WHEN** the workbench renders the current Agent identity in the right-side context panel
- **THEN** the panel MUST use the same backend-driven Agent title priority as the home stage and active session surfaces
- **AND** the visible Agent name in that panel MUST remain consistent with the main content surfaces for the same selected agent
