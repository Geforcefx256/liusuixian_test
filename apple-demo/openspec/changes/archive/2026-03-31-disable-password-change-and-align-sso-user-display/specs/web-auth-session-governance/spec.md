## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Self-service password change MUST remain disabled across auth modes
The system SHALL not expose self-service password change as a supported authentication capability in local mode or OAuth mode.

#### Scenario: Authenticated user calls the password-change endpoint
- **WHEN** an authenticated session submits a password-change request
- **THEN** the backend MUST reject the request as unsupported
- **AND** the system MUST NOT update stored password state or session state

## REMOVED Requirements

### Requirement: Password change invalidates all existing sessions
**Reason**: The product no longer supports self-service password change in any authentication mode.
**Migration**: Remove any callers, tests, and documentation that treat password change as a supported security flow.
