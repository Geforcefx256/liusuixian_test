## MODIFIED Requirements

### Requirement: OAuth identity binding MUST tolerate minimal upstream userinfo while preserving deterministic identity keys
The system SHALL accept source-compatible minimal OAuth userinfo payloads as long as the stable external user identifier is present, and SHALL still produce deterministic identity binding and provisioning behavior.

#### Scenario: First-time OAuth login succeeds with only the stable identifier
- **WHEN** a first-time OAuth callback returns the required stable external user identifier but omits optional fields such as login name, display name, email, phone, or avatar
- **THEN** the system MUST still create or bind the OAuth identity deterministically
- **AND** the system MUST derive any required fallback local account fields without rejecting the login solely for missing optional profile data

#### Scenario: Returning OAuth login does not duplicate a sparse identity
- **WHEN** a returning OAuth login provides the same stable external user identifier with only minimal optional profile fields
- **THEN** the system MUST match the existing identity binding
- **AND** the system MUST NOT create a duplicate local user or duplicate identity record

#### Scenario: Internal SSO uses uuid and uid for sparse provisioning
- **WHEN** the internal SSO callback returns `uuid` as the stable user identifier and `uid` as the only account-style field
- **THEN** the system MUST use `uuid` as the external identity key for binding
- **AND** the system MUST use `uid` as the canonical account identifier for local provisioning fallbacks
- **AND** the system MUST use that same `uid` value as the default visible display string when no richer display name is available
