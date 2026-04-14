## ADDED Requirements

### Requirement: Vue frontend MUST provide the new agent workbench shell
The system SHALL implement the new `apps/web` frontend as a Vue-based agent workbench whose layout follows the product structure established by `index-v10.html`.

#### Scenario: Home stage is shown before a session is active
- **WHEN** an authenticated user enters the workbench without selecting an active session
- **THEN** the frontend MUST show a home stage with agent identity, skill entry area, and message composer

#### Scenario: Workbench stage is shown for an active session
- **WHEN** the user creates or opens an agent session
- **THEN** the frontend MUST switch to the workbench stage
- **AND** the workbench MUST include history sessions, assistant conversation area, and workspace context area

### Requirement: Workbench MUST integrate with backend agent session and streaming APIs
The system SHALL use the migrated agent backend APIs to create sessions, list sessions, load message history, and stream agent responses.

#### Scenario: User creates a new session
- **WHEN** the user starts a new conversation from the home stage or session rail
- **THEN** the frontend MUST create a backend session for the selected agent
- **AND** the new session MUST appear in the session history list

#### Scenario: User opens an existing session
- **WHEN** the user selects a previous session from the session history list
- **THEN** the frontend MUST load the message history for that session
- **AND** the conversation area MUST render the loaded messages in session order

#### Scenario: User sends a new prompt
- **WHEN** the user submits a prompt in an active session
- **THEN** the frontend MUST invoke the backend run stream API for that session
- **AND** the conversation area MUST render streamed assistant events until the run reaches a terminal state

### Requirement: Workbench MUST provide a lightweight workspace context panel in phase 1
The system SHALL expose task context and uploaded files in the workbench, but SHALL NOT require file content preview, text editing, or table editing in the first phase.

#### Scenario: Uploaded files are visible in the workspace context
- **WHEN** the user uploads one or more supported files
- **THEN** the frontend MUST send the files through the backend upload API
- **AND** the workbench MUST show the returned uploaded file entries in the workspace context area

#### Scenario: First phase does not depend on file preview
- **WHEN** the user opens the workbench in phase 1
- **THEN** the non-chat work area MUST remain usable without rendering file content preview
- **AND** the first phase MUST treat the area as context, status, and file listing space rather than a document editor

### Requirement: Workbench MUST initialize from backend agent metadata
The system SHALL load agent metadata from the migrated backend so that the workbench shell is driven by real backend configuration instead of static prototype constants.

#### Scenario: Agent metadata populates the home shell
- **WHEN** the frontend loads the available agent or selected agent detail successfully
- **THEN** the workbench MUST use backend-provided agent identity and capability data to populate the home-stage header and skill area

#### Scenario: Runtime bootstrap configures session behavior
- **WHEN** the frontend loads runtime bootstrap for the active agent
- **THEN** the frontend MUST use that bootstrap payload to initialize the session experience and backend-driven runtime context
