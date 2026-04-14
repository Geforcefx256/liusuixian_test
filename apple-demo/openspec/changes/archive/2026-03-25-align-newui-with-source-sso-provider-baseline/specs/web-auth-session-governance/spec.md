## ADDED Requirements

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
