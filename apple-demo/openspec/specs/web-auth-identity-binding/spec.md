# web-auth-identity-binding Specification

## Purpose
TBD - created by archiving change harden-web-auth-session-model. Update Purpose after archive.
## Requirements
### Requirement: OAuth identities MUST be keyed by provider and external user identifier
The system SHALL treat the combination of provider code and external user identifier as the stable key for an OAuth identity.

#### Scenario: Returning OAuth user matches an existing bound identity
- **WHEN** an OAuth callback resolves to a provider code and external user identifier that already exists in the system
- **THEN** the system MUST authenticate the local user bound to that identity
- **AND** the system MUST NOT create a duplicate local user

#### Scenario: First-time OAuth user creates or binds identity through the defined policy
- **WHEN** an OAuth callback resolves to a provider code and external user identifier that is not yet known
- **THEN** the system MUST apply the configured first-login identity policy
- **AND** the result MUST be either a successful new binding or an explicit rejection

### Requirement: Identity conflicts MUST be handled explicitly
The system SHALL not silently merge OAuth identities into local users based only on mutable profile fields such as login name or email.

#### Scenario: Login name conflict is rejected explicitly
- **WHEN** a first-time OAuth login would map to a local account identifier that is already used by another user
- **THEN** the system MUST reject the login with an explicit identity-conflict result
- **AND** the system MUST NOT silently bind the OAuth identity to that existing user

#### Scenario: Email match alone does not auto-merge identities
- **WHEN** a first-time OAuth login returns an email address that already exists on another local user
- **THEN** the system MUST NOT automatically merge the OAuth identity into that user based on email alone

### Requirement: First-login provisioning MUST apply a deterministic default access policy
The system SHALL apply a deterministic default access policy when an OAuth identity is provisioned for the first time.

#### Scenario: First-time OAuth user receives the configured default normal-user role policy
- **WHEN** a new local user is created from a first-time OAuth login
- **THEN** the system MUST assign roles according to the configured default provisioning policy
- **AND** the default provisioning policy for this product change MUST grant the normal `user` role rather than `guest`
- **AND** the assigned roles MUST NOT depend on incidental implementation order

#### Scenario: Repeated OAuth login preserves the existing local user roles
- **WHEN** a previously bound OAuth user logs in again
- **THEN** the system MUST preserve the current role assignments of the bound local user
- **AND** the system MUST update identity login metadata without reprovisioning the user

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

