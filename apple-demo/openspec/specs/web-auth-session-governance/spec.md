# web-auth-session-governance Specification

## Purpose
TBD - created by archiving change harden-web-auth-session-model. Update Purpose after archive.
## Requirements
### Requirement: Web authentication modes MUST enforce backend capability boundaries
The system SHALL expose explicit web authentication modes and SHALL enforce the allowed login mechanisms on the backend, not only in frontend presentation.

#### Scenario: Local-only mode exposes only local login
- **WHEN** the system is configured for local-only authentication
- **THEN** the auth mode response MUST indicate that local login is enabled
- **AND** the system MUST NOT expose OAuth login as an allowed login mechanism

#### Scenario: OAuth-preferred mode allows both login paths with OAuth as the preferred entry
- **WHEN** the system is configured for OAuth-preferred authentication
- **THEN** the auth mode response MUST indicate that both OAuth and local login are allowed
- **AND** the response MUST identify OAuth as the preferred login path

#### Scenario: OAuth-only mode rejects local password login
- **WHEN** the system is configured for OAuth-only authentication
- **THEN** the auth mode response MUST indicate that OAuth is the only allowed login mechanism
- **AND** any local password login request MUST be rejected by the backend

### Requirement: OAuth login transactions MUST be explicitly issued and single-use
The system SHALL issue OAuth login transactions from a dedicated login-start step and SHALL validate callback requests against a persisted, single-use transaction.

#### Scenario: Auth mode discovery does not create login state
- **WHEN** a client requests the auth mode discovery endpoint
- **THEN** the system MUST return login capabilities without creating an OAuth login transaction

#### Scenario: Login start creates a persisted transaction
- **WHEN** a client requests an OAuth login URL from the dedicated login-start endpoint
- **THEN** the system MUST create a persisted OAuth login transaction with a unique `state`
- **AND** the transaction MUST have an expiration time
- **AND** the returned login URL MUST include the issued `state`

#### Scenario: Callback consumes the transaction exactly once
- **WHEN** the OAuth callback is received with a valid code and matching unexpired `state`
- **THEN** the system MUST consume the matching login transaction
- **AND** the same `state` MUST NOT be accepted again

#### Scenario: Expired or unknown state is rejected
- **WHEN** the OAuth callback is received with an expired, already-consumed, or unknown `state`
- **THEN** the system MUST reject the callback
- **AND** the system MUST NOT create a local session

### Requirement: Session lifecycle MUST be governed by security events
The system SHALL treat sessions as server-governed state and SHALL invalidate them consistently when user security state changes.

#### Scenario: Current session is revoked on logout
- **WHEN** an authenticated user logs out from the current device
- **THEN** the system MUST revoke the current session
- **AND** the session cookie for that device MUST be cleared

#### Scenario: Disabled user loses all active sessions
- **WHEN** a user is disabled after sessions have already been issued
- **THEN** the system MUST reject further authenticated requests for every active session of that user

#### Scenario: Expired session is rejected even if cookie is still present
- **WHEN** a request presents a session whose expiration time has passed
- **THEN** the system MUST reject the request
- **AND** the user MUST be treated as unauthenticated

### Requirement: Self-service password change MUST remain disabled across auth modes
The system SHALL not expose self-service password change as a supported authentication capability in local mode or OAuth mode.

#### Scenario: Authenticated user calls the password-change endpoint
- **WHEN** an authenticated session submits a password-change request
- **THEN** the backend MUST reject the request as unsupported
- **AND** the system MUST NOT update stored password state or session state

### Requirement: Same-origin protection MUST support wildcard allowlists across auth-integrated surfaces
The system SHALL allow same-origin protection policies to accept wildcard origin patterns so that the web auth surface and the agent-backed auth-integrated surface can share the source repository's allowed-origin behavior.

#### Scenario: Wildcard development origin is accepted
- **WHEN** same-origin protection is configured with a wildcard origin pattern such as `http://localhost:517*`
- **THEN** a matching state-changing request origin MUST be accepted
- **AND** the request MUST continue through the protected route

#### Scenario: Non-matching origin is rejected even when a wildcard policy exists
- **WHEN** a state-changing request origin does not match the configured exact or wildcard allowlist
- **THEN** the protected route MUST reject the request
- **AND** the system MUST return an explicit cross-origin rejection result

### Requirement: Session cookie policy MUST preserve same-site sessions across port-separated entry points
The system SHALL issue and clear auth session cookies in a way that preserves valid SSO sessions when the frontend and auth callback surface are same-site but separated by port, matching the source repository's cookie behavior.

#### Scenario: Cross-port same-site login preserves the session cookie
- **WHEN** the auth callback and frontend entry are on the same site but on different ports
- **THEN** the system MUST choose cookie attributes that allow the session cookie to survive that flow
- **AND** the resulting authenticated session MUST be usable from the frontend workbench entry

#### Scenario: Same-origin local flow keeps the stricter local cookie policy
- **WHEN** login and subsequent workbench access occur from the same origin without a cross-port handoff
- **THEN** the system MUST keep the stricter same-origin cookie policy
- **AND** the cookie behavior MUST remain compatible with local authenticated requests

### Requirement: OAuth-backed sessions MUST support upstream token lifecycle and server-governed logout
The system SHALL align OAuth-backed sessions with the source repository's upstream token lifecycle, including refresh handling, explicit refresh failure behavior, and upstream logout coordination when configured.

#### Scenario: Expiring OAuth session is refreshed within the configured refresh window
- **WHEN** an authenticated OAuth-backed session is still locally valid but its upstream access token enters the configured refresh window
- **THEN** the system MUST refresh the upstream token set before treating the session as expired
- **AND** the refreshed session state MUST remain server-governed

#### Scenario: Logout revokes the local session and returns upstream logout intent
- **WHEN** an authenticated OAuth-backed user logs out and upstream logout is configured
- **THEN** the system MUST revoke the local session
- **AND** the logout result MUST preserve the backend-governed upstream logout completion intent needed by the frontend

#### Scenario: Unrefreshable OAuth session fails explicitly
- **WHEN** an OAuth-backed session requires refresh but the system has no valid refresh path
- **THEN** the system MUST fail the session explicitly
- **AND** the user MUST be treated as unauthenticated rather than silently kept logged in

