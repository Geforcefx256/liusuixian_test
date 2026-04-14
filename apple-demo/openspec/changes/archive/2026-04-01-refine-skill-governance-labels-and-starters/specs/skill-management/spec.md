## MODIFIED Requirements

### Requirement: Managed skills SHALL define agent binding and governed display metadata
The system SHALL allow administrators to bind managed skills to specific agents and define the governed user-facing name, description, and display-surface metadata used in managed product surfaces.

#### Scenario: Managed skill is bound to one agent but not another
- **WHEN** an administrator binds a managed skill to a selected agent set
- **THEN** only those bound agents MUST receive the skill in their governed runtime surface
- **AND** unbound agents MUST NOT expose the skill in governed metadata or execution paths

#### Scenario: User-facing discovery shows governed description only
- **WHEN** a governed product surface lists a managed skill for an end user
- **THEN** the system MUST show the governed name and description for that skill
- **AND** the system MUST NOT expose the raw `SKILL.md` body or internal execution instructions to that end user

#### Scenario: Administrator edits governed surface labels with product terminology
- **WHEN** an administrator views or edits display-surface metadata for a managed skill in the management UI
- **THEN** the UI MUST present the field using the user-facing label `展示`
- **AND** the selectable governed surface labels MUST be `生产` and `测试`
- **AND** persisting those labels MUST continue to map to the existing managed surface policy without changing canonical skill package contents
