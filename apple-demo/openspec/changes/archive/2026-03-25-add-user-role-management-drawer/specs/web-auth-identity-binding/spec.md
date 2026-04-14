## MODIFIED Requirements

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
