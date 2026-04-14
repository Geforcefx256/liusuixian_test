## ADDED Requirements

### Requirement: Managed skill registry SHALL govern imported standard skills
The system SHALL provide a managed skill registry that imports standard skill packages without modifying their canonical `SKILL.md` format and stores product-surface governance separately from the skill body.

#### Scenario: Importing a standard skill creates a managed record
- **WHEN** an administrator imports a standard skill package into the system
- **THEN** the system MUST create or update a managed skill record linked to the imported canonical skill
- **AND** the managed record MUST store governance metadata separately from the raw `SKILL.md` body

#### Scenario: Canonical skill format remains unchanged
- **WHEN** a managed record is created for an imported skill
- **THEN** the system MUST preserve the canonical package structure and `SKILL.md` content as the execution source
- **AND** product-surface policy MUST NOT require adding UI-governance fields to the skill package itself

### Requirement: Managed skills SHALL control production versus experimental surface policy
The system SHALL let administrators decide whether a managed skill is production-visible or experimental without removing the canonical skill package from the system.

#### Scenario: Experimental skill is withheld from production surface
- **WHEN** a managed skill is marked experimental
- **THEN** the system MUST keep the skill out of production user-facing discovery surfaces
- **AND** the system MUST prevent production runtime surfaces from treating that skill as available by default

#### Scenario: Production skill is promoted without reauthoring the package
- **WHEN** an administrator promotes a managed skill from experimental to production
- **THEN** the system MUST expose the same canonical skill package through production surfaces
- **AND** the promotion MUST NOT require editing the underlying `SKILL.md`

### Requirement: Managed skills SHALL define agent binding and governed display metadata
The system SHALL allow administrators to bind managed skills to specific agents and define the user-facing display description used in governed product surfaces.

#### Scenario: Managed skill is bound to one agent but not another
- **WHEN** an administrator binds a managed skill to a selected agent set
- **THEN** only those bound agents MUST receive the skill in their governed runtime surface
- **AND** unbound agents MUST NOT expose the skill in governed metadata or execution paths

#### Scenario: User-facing discovery shows governed description only
- **WHEN** a governed product surface lists a managed skill for an end user
- **THEN** the system MUST show the governed name and description for that skill
- **AND** the system MUST NOT expose the raw `SKILL.md` body or internal execution instructions to that end user
