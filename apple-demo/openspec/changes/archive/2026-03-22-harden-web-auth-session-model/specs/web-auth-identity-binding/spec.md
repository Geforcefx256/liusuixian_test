## ADDED Requirements

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

#### Scenario: First-time OAuth user receives the configured default role policy
- **WHEN** a new local user is created from a first-time OAuth login
- **THEN** the system MUST assign roles according to the configured default provisioning policy
- **AND** the assigned roles MUST NOT depend on incidental implementation order

#### Scenario: Repeated OAuth login preserves the existing local user roles
- **WHEN** a previously bound OAuth user logs in again
- **THEN** the system MUST preserve the current role assignments of the bound local user
- **AND** the system MUST update identity login metadata without reprovisioning the user
