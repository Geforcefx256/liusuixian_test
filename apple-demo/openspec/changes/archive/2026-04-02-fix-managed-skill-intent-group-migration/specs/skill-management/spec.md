## ADDED Requirements

### Requirement: Managed skill governance SHALL migrate legacy intent-group metadata
The system SHALL validate persisted managed skill `intentGroup` metadata against the current governed intent-group set when loading managed skill records, and MUST migrate any legacy invalid value before that record is exposed through admin APIs or reused by a save flow.

#### Scenario: Legacy intent group maps to the current default governed group
- **WHEN** a persisted managed skill record contains a legacy invalid `intentGroup`
- **AND** the current managed-skill defaults define a valid governed `intentGroup` for that same `skillId`
- **THEN** the registry MUST replace the legacy value with that current valid default during load
- **AND** the repaired record MUST be exposed through admin APIs with only the repaired valid value

#### Scenario: Legacy intent group is cleared when no current governed group exists
- **WHEN** a persisted managed skill record contains a legacy invalid `intentGroup`
- **AND** the current managed-skill defaults do not define a valid governed `intentGroup` for that `skillId`
- **THEN** the registry MUST clear the stored `intentGroup` to an ungrouped state during load
- **AND** the system MUST NOT silently invent a replacement governed group for that skill

#### Scenario: Registry persists repaired intent-group metadata
- **WHEN** the registry repairs one or more legacy invalid `intentGroup` values during initialization
- **THEN** it MUST rewrite the managed skill registry file with the repaired metadata
- **AND** subsequent process restarts MUST NOT reintroduce the prior legacy values from the persisted file

### Requirement: Managed skill administration SHALL remain recoverable when legacy intent-group data is encountered
The admin skill management workflow SHALL remain operable even when a managed skill record originated from legacy invalid `intentGroup` metadata, and MUST expose that remediation explicitly rather than failing with `Invalid intentGroup`.

#### Scenario: Admin UI shows a remediated ungrouped state for an invalid legacy value
- **WHEN** the management UI receives a managed skill record whose `intentGroup` is not part of the current governed set
- **THEN** the `意图分组` control MUST render that skill as `未分组`
- **AND** the UI MUST show explicit guidance that the previous stored group is no longer valid and needs reselection or an ungrouped save

#### Scenario: Save flow never round-trips an unknown intent-group value
- **WHEN** an administrator saves managed skill governance after opening a record that previously contained a legacy invalid `intentGroup`
- **THEN** the management client MUST submit only a current valid `intentGroup` or `null`
- **AND** the admin save flow MUST NOT send the legacy invalid identifier back to the backend as part of the save payload
