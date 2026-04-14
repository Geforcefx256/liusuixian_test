# agent-web-auth Specification

## Purpose
TBD - created by archiving change build-vue-agent-workbench-lite. Update Purpose after archive.
## Requirements
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
The system SHALL derive workbench entry behavior from `/web/api/auth/mode` and SHALL remain compatible with the full SSO contract defined by the source repository baseline, including local login availability, OAuth-preferred entry, OAuth-only entry, dedicated login-start handling, and callback completion before workbench access.

#### Scenario: Local login remains the only entry when OAuth is unavailable
- **WHEN** the backend reports that only local login is allowed or OAuth is not effectively configured
- **THEN** the frontend MUST present the local account-and-password login path
- **AND** the frontend MUST NOT auto-start an OAuth redirect

#### Scenario: OAuth-preferred entry starts from backend-issued login state
- **WHEN** the backend reports OAuth as the preferred login path
- **THEN** the frontend MUST obtain the login URL from the backend login-start endpoint instead of constructing it locally
- **AND** the frontend MUST treat the returned URL and callback parameters as server-governed SSO state

#### Scenario: OAuth-only entry blocks local credential login
- **WHEN** the backend reports that OAuth is the only allowed login mechanism
- **THEN** the frontend MUST block local credential submission
- **AND** the frontend MUST require completion of the backend-governed OAuth flow before entering the workbench

### Requirement: Frontend MUST expose current user identity and logout
The system SHALL show the authenticated user identity in the workbench shell and SHALL execute logout according to the backend-governed session contract, including source-compatible OAuth logout completion behavior when upstream sign-out is configured.

#### Scenario: Current user identity remains sourced from the backend session
- **WHEN** the frontend loads an authenticated workbench session
- **THEN** the header MUST display the current user identity returned by the auth API
- **AND** the frontend MUST NOT synthesize identity state independently from the backend response

#### Scenario: Sparse SSO identity still renders a deterministic visible account
- **WHEN** the authenticated session omits avatar and role presentation data but includes a backend-provided account or display string
- **THEN** the header MUST render the visible account string from the backend session
- **AND** the frontend MUST derive the fallback avatar from the first character of that visible account string
- **AND** the frontend MUST NOT show placeholder role copy when no user-facing role label is available

#### Scenario: Logout follows backend-governed completion behavior
- **WHEN** the user triggers logout from the workbench shell
- **THEN** the frontend MUST call the backend logout API before clearing local auth state
- **AND** the frontend MUST honor backend-governed logout completion behavior, including any source-compatible upstream sign-out redirect contract
- **AND** the frontend MUST return the user to an unauthenticated entry state after logout finishes

### Requirement: Frontend MUST NOT expose self-service password management
The system SHALL not present self-service password change as an available user action in the workbench shell.

#### Scenario: Authenticated user opens the account menu
- **WHEN** an authenticated user opens the workbench account menu in local mode or OAuth mode
- **THEN** the menu MUST NOT show a password-change action
- **AND** the frontend MUST NOT render a password-change modal or form for the current user session

