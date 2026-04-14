## MODIFIED Requirements

### Requirement: Managed skill registry SHALL govern imported standard skills
The system SHALL provide a managed skill registry that imports standard skill packages without modifying their canonical `SKILL.md` format, preserves any canonical governed script manifest (`SCRIPTS.yaml`) packaged with the skill, and stores product-surface governance separately from the skill body.

#### Scenario: Importing a standard skill creates a managed record
- **WHEN** an administrator imports a standard skill package into the system
- **THEN** the system MUST create or update a managed skill record linked to the imported canonical skill
- **AND** the managed record MUST store governance metadata separately from the raw `SKILL.md` body and any canonical script manifest content

#### Scenario: Canonical skill package structure remains unchanged
- **WHEN** a managed record is created for an imported skill
- **THEN** the system MUST preserve the canonical package structure, `SKILL.md` content, and canonical `SCRIPTS.yaml` manifest as the execution source
- **AND** product-surface policy MUST NOT require adding UI-governance fields to the skill package itself

### Requirement: Managed skill governance SHALL remain authoritative for runtime skill exposure
The system SHALL continue to use managed skill governance as the authoritative source for which canonical skills and governed script templates are exposed to an agent runtime surface and to governed product metadata after the backend capability migration.

#### Scenario: Governed agent catalog still resolves managed skill records
- **WHEN** the migrated backend builds agent detail or execution catalog data for an agent
- **THEN** the runtime MUST continue to resolve the visible skill set from managed skill governance for that agent
- **AND** governed display metadata from the managed registry MUST continue to override raw canonical skill metadata in governed product surfaces

#### Scenario: Governed script templates follow the same approval boundary
- **WHEN** the runtime materializes executable script templates from canonical skill packages
- **THEN** it MUST expose those templates only for skills that are approved for the current governed runtime surface
- **AND** it MUST treat unapproved skill scripts as unavailable even when their canonical `SCRIPTS.yaml` exists locally

#### Scenario: Skill and script access both reject known but unapproved skills
- **WHEN** a request asks the runtime to load a canonical skill body or invoke a canonical script from a skill that exists in the catalog but is not approved for the current governed runtime surface
- **THEN** the runtime MUST reject that request as an unapproved skill access
- **AND** the runtime MUST NOT expose the raw `SKILL.md` body or executable script metadata for that denied skill through the governed execution path
