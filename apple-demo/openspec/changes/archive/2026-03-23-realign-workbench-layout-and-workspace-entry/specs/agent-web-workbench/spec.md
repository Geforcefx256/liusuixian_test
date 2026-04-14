## REMOVED Requirements

### Requirement: Vue frontend MUST provide the new agent workbench shell
**Reason**: The previous requirement hard-coded a separate home-stage versus workbench-stage model that no longer matches the desired conversation-first shell.
**Migration**: Replace stage switching tied to “no active session” with a persistent base shell plus an independent workspace-expanded state.

### Requirement: Workbench MUST integrate with backend agent session and streaming APIs
**Reason**: The previous requirement assumed that creating a new conversation must immediately create a backend session and did not cover preview-rich history or session deletion behavior.
**Migration**: Use the updated session lifecycle and history requirement below, including deferred session creation and confirmed deletion.

### Requirement: Workbench MUST provide a lightweight workspace context panel in phase 1
**Reason**: The right side is no longer defined as a status/context card surface.
**Migration**: Replace the context panel with a persistent workspace sidebar and a minimal workspace-open shell.

### Requirement: Workbench MUST present a consistent Agent identity across home and active session states
**Reason**: The updated shell no longer uses a separate home-stage page mode.
**Migration**: Preserve shared agent identity across the base conversation shell and the workspace-expanded shell instead.

### Requirement: Phase 1 workbench surfaces MUST align visually without expanding workspace scope
**Reason**: The previous requirement was framed around home-stage and context-panel surfaces that are being removed.
**Migration**: Use the updated conversation-first shell alignment requirement below.

### Requirement: Workbench home stage SHALL project governed core-network starter groups
**Reason**: The workbench no longer uses a dedicated home stage before conversation starts.
**Migration**: Move governed starter affordances into the empty conversation shell rather than a separate landing page.

## ADDED Requirements

### Requirement: Authenticated workbench SHALL default to a conversation-first base shell
The system SHALL render authenticated users into a persistent base workbench shell that includes a history rail, a central conversation surface, and a visible right-side workspace sidebar without requiring a separate home-stage page mode.

#### Scenario: User enters the workbench without a persisted active session
- **WHEN** an authenticated user opens the workbench and no persisted session is currently selected
- **THEN** the frontend MUST still render the standard workbench shell
- **AND** the central surface MUST present an empty conversation state rather than navigating to a separate home page
- **AND** the right-side workspace sidebar MUST remain visible in that empty conversation state

#### Scenario: Workspace area is not opened during normal conversation
- **WHEN** the user is viewing the base workbench shell and has not opened a workspace file
- **THEN** the frontend MUST keep the conversation surface as the primary center pane
- **AND** the frontend MUST NOT display the central workspace editor area solely because a session exists

### Requirement: Workbench SHALL manage draft conversations, persisted sessions, and history rail actions distinctly
The system SHALL distinguish a blank conversation draft from a persisted backend session and SHALL present session history in a collapsed-by-default rail with preview and deletion behavior.

#### Scenario: New conversation returns to a blank conversation shell
- **WHEN** the user triggers the new-conversation action from the history rail
- **THEN** the frontend MUST clear the currently selected persisted session from the UI
- **AND** the workbench MUST return to an empty conversation state inside the standard workbench shell
- **AND** the frontend MUST NOT create a backend session until the user sends the first prompt for that draft

#### Scenario: First prompt creates the persisted session
- **WHEN** the user sends the first prompt from a blank conversation state
- **THEN** the frontend MUST create a backend session for the selected agent before streaming the run
- **AND** the new session MUST appear in the history rail after creation

#### Scenario: Expanded history rail shows preview-rich entries
- **WHEN** the user expands the history rail
- **THEN** the frontend MUST show searchable session entries with title, updated time, and a one-line preview string
- **AND** the collapsed state MAY reduce those entries to icon-only affordances

#### Scenario: Session deletion requires confirmation
- **WHEN** the user chooses to delete a session from the expanded history rail
- **THEN** the frontend MUST request explicit confirmation before issuing the delete
- **AND** a confirmed delete MUST remove the session from the visible history list

### Requirement: Workbench SHALL provide a persistent workspace sidebar and a minimal workspace-open shell
The system SHALL treat the right-side work area as a persistent workspace sidebar for the current `user + agent` workspace and SHALL open a separate central workspace shell only when the user explicitly opens a workspace file.

#### Scenario: Workspace sidebar is visible during normal conversation
- **WHEN** the user is in the base workbench shell
- **THEN** the right side MUST show a workspace sidebar rather than status-summary cards
- **AND** that sidebar MUST expose workspace entry points such as file groups, file items, upload controls, or template entry points

#### Scenario: Workspace heading does not reuse session naming
- **WHEN** the user views the right-side workspace sidebar while switching between sessions for the same agent
- **THEN** the workspace heading and root grouping MUST continue to represent the current `user + agent` workspace
- **AND** the sidebar MUST NOT present the selected session title as the workspace title

#### Scenario: User opens a workspace file from the sidebar
- **WHEN** the user opens a workspace file from the right-side workspace sidebar
- **THEN** the frontend MUST enter a workspace-expanded state
- **AND** the layout MUST insert a central workspace area between the conversation surface and the workspace sidebar
- **AND** the workspace-expanded state MUST keep the conversation surface visible

#### Scenario: Minimum viable workspace does not require editing
- **WHEN** the user first opens a workspace file in this change
- **THEN** the central workspace area MUST provide an intentional shell with active-file context and placeholder content
- **AND** the system MUST NOT require text editing, table editing, save, or download behavior to satisfy this requirement

#### Scenario: Workspace sidebar can be collapsed manually
- **WHEN** the user is in the workspace-expanded state
- **THEN** the workspace sidebar MUST remain visible by default
- **AND** the user MUST be able to collapse and later re-expand that sidebar without closing the active workspace file

#### Scenario: Switching sessions does not redefine workspace ownership
- **WHEN** the user selects a different session for the same active agent
- **THEN** the conversation surface MUST switch to the selected session history
- **AND** the workspace sidebar MUST continue to represent the same `user + agent` workspace unless the active agent changes

### Requirement: Workbench SHALL preserve governed starter affordances inside the empty conversation shell
The workbench SHALL continue to project governed starter guidance for the active agent, but it SHALL do so within the empty conversation shell instead of a separate home-stage page mode.

#### Scenario: Empty conversation shell shows governed representative starter groups
- **WHEN** an authenticated user views the workbench with no persisted session selected or with an empty draft conversation
- **THEN** the conversation surface MUST be able to show governed starter entries grouped by the supported task-group model for the active agent

#### Scenario: Empty starter group falls back to governed discovery
- **WHEN** a governed starter group has no representative managed skill for the current agent surface
- **THEN** the empty conversation shell MUST render a governed discovery fallback instead of fabricating a representative entry

### Requirement: Workbench SHALL keep agent identity and visual language consistent across base and expanded shells
The system SHALL preserve a consistent agent identity and aligned visual language across the base conversation shell and the workspace-expanded shell while staying within the minimum viable workspace scope.

#### Scenario: Shared agent identity is visible in the conversation-led shell
- **WHEN** the user views either the empty conversation shell or a persisted conversation
- **THEN** the conversation surface MUST display the active agent using backend-driven identity metadata
- **AND** that identity treatment MUST remain visually consistent before and after a session is persisted

#### Scenario: Workspace-expanded shell keeps the same conversation and brand language
- **WHEN** the user opens the workspace-expanded shell
- **THEN** the shell MUST preserve the same top-level brand and conversation-composer visual language used by the base workbench
- **AND** the change MUST NOT reintroduce a heavyweight standalone landing card or status-card workspace panel

#### Scenario: Pane-owned scrolling prevents page-level overflow
- **WHEN** the workbench content exceeds the available viewport height
- **THEN** the page itself MUST avoid a global vertical scrollbar for the full shell
- **AND** the history rail, conversation surface, workspace area, and workspace sidebar MUST use pane-owned scrolling as needed
