## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Frontend MUST NOT expose self-service password management
The system SHALL not present self-service password change as an available user action in the workbench shell.

#### Scenario: Authenticated user opens the account menu
- **WHEN** an authenticated user opens the workbench account menu in local mode or OAuth mode
- **THEN** the menu MUST NOT show a password-change action
- **AND** the frontend MUST NOT render a password-change modal or form for the current user session
