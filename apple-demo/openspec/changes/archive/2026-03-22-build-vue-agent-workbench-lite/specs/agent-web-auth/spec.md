## ADDED Requirements

### Requirement: Vue workbench MUST enforce authenticated entry
The system SHALL provide a Vue-based authentication entry flow for the new `apps/web` frontend and SHALL prevent unauthenticated users from entering the agent workbench.

#### Scenario: Unauthenticated user is redirected to login
- **WHEN** a user opens the workbench entry without an active authenticated session
- **THEN** the frontend MUST block workbench initialization
- **AND** the frontend MUST present a login experience before the user can access the workbench

#### Scenario: Authenticated user enters workbench directly
- **WHEN** a user opens the workbench entry with a valid authenticated session
- **THEN** the frontend MUST load the current user context
- **AND** the frontend MUST enter the workbench without asking the user to log in again

### Requirement: Frontend MUST honor backend auth mode selection
The system SHALL discover the preferred authentication mode from `/web/api/auth/mode` and SHALL render the corresponding login behavior in the Vue frontend.

#### Scenario: Local login is available
- **WHEN** the backend reports local login as the active or available mode
- **THEN** the frontend MUST provide an account-and-password login form
- **AND** the frontend MUST submit login credentials through the backend auth API

#### Scenario: OAuth login is preferred
- **WHEN** the backend reports OAuth as the preferred login mode
- **THEN** the frontend MUST start the OAuth login flow using the backend-provided login URL
- **AND** the frontend MUST complete the callback flow before entering the workbench

### Requirement: Frontend MUST expose current user identity and logout
The system SHALL show the authenticated user identity in the workbench shell and SHALL allow the user to terminate the current session from the Vue frontend.

#### Scenario: Current user is shown in the shell
- **WHEN** the frontend has loaded the authenticated session successfully
- **THEN** the workbench header MUST display the current user identity returned by the auth API

#### Scenario: User logs out from the workbench
- **WHEN** the user triggers logout from the workbench shell
- **THEN** the frontend MUST call the backend logout API
- **AND** the frontend MUST clear authenticated frontend state
- **AND** the frontend MUST return the user to the login experience
