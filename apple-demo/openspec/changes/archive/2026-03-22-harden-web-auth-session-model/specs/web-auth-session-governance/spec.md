## ADDED Requirements

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

#### Scenario: Password change invalidates all existing sessions
- **WHEN** a local-authenticated user successfully changes their password
- **THEN** the system MUST invalidate all existing sessions for that user
- **AND** subsequent requests using those sessions MUST be rejected

#### Scenario: Disabled user loses all active sessions
- **WHEN** a user is disabled after sessions have already been issued
- **THEN** the system MUST reject further authenticated requests for every active session of that user

#### Scenario: Expired session is rejected even if cookie is still present
- **WHEN** a request presents a session whose expiration time has passed
- **THEN** the system MUST reject the request
- **AND** the user MUST be treated as unauthenticated
