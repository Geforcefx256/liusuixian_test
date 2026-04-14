## ADDED Requirements

### Requirement: Managed skill governance SHALL remain authoritative for runtime skill exposure
The system SHALL continue to use managed skill governance as the authoritative source for which canonical skills are exposed to an agent runtime surface and to governed product metadata after the backend capability migration.

#### Scenario: Governed agent catalog still resolves managed skill records
- **WHEN** the migrated backend builds agent detail or execution catalog data for an agent
- **THEN** the runtime MUST continue to resolve the visible skill set from managed skill governance for that agent
- **AND** governed display metadata from the managed registry MUST continue to override raw canonical skill metadata in governed product surfaces

#### Scenario: Skill tool still rejects known but unapproved skills
- **WHEN** a request asks the skill tool to load a canonical skill that exists in the catalog but is not approved for the current governed runtime surface
- **THEN** the runtime MUST reject that request as an unapproved skill access
- **AND** the runtime MUST NOT expose the raw `SKILL.md` body for that denied skill through the governed skill path

### Requirement: Managed skill governance SHALL coexist with runtime tool deny policy
The system SHALL allow runtime tool deny policy to coexist with managed skill governance without replacing the governance layer or weakening its authorization semantics.

#### Scenario: Tool deny policy blocks tools after governance filtering
- **WHEN** the runtime builds a tool catalog for an agent request
- **THEN** the runtime MAY apply tool deny policy after the governed skill and tool surface is resolved
- **AND** the deny policy MUST NOT be treated as a replacement for managed skill approval and binding rules

#### Scenario: Managed skill administration remains available with deny policy enabled
- **WHEN** runtime tool deny policy is enabled in the migrated backend
- **THEN** administrators MUST still be able to import, inspect, and update managed skill records through the current admin skill APIs
- **AND** enabling deny policy MUST NOT disable managed skill governance workflows
