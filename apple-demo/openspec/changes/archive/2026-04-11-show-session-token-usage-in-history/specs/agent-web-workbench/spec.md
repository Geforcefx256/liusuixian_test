## ADDED Requirements

### Requirement: Workbench SHALL show session token totals only in admin history management
The workbench SHALL expose session-level token totals only to `admin` and `super_admin` users inside the history-management panel. This usage display MUST remain absent from the current conversation surface and from ordinary non-admin views.

#### Scenario: Admin sees a weak token badge in history management
- **WHEN** an `admin` or `super_admin` opens the history-management panel and a session usage summary is available
- **THEN** the workbench MUST render that session's cumulative token total as a weak metadata badge within the corresponding history item
- **AND** the badge MUST remain visually secondary to the session title and update time

#### Scenario: Non-admin sees no token usage metadata
- **WHEN** a non-admin user opens the history-management panel
- **THEN** the workbench MUST NOT request or render session token totals for the listed sessions
- **AND** the history item layout MUST NOT reserve placeholder space for a hidden token badge

#### Scenario: Current conversation surface does not show session totals
- **WHEN** any user views the active conversation shell for the current session
- **THEN** the workbench MUST NOT render the session's cumulative token total in the conversation header, composer, or message area
- **AND** token totals MUST remain scoped to the history-management panel

#### Scenario: Token usage load failure does not block history interaction
- **WHEN** the history-management panel fails to load token usage for one or more sessions
- **THEN** the workbench MUST keep the history list, session selection, and ordinary conversation flow available
- **AND** it MUST NOT replace the failed token value with a fake `0 tok` badge
