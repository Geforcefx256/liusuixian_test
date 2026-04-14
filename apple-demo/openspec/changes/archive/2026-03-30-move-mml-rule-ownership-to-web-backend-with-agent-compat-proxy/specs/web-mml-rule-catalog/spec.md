## ADDED Requirements

### Requirement: Web backend SHALL own the imported MML rule catalog lifecycle
The web backend SHALL treat fixed Excel-backed MML rule workbooks as the canonical source for `networkType + networkVersion` schema lookup and SHALL own the import, storage, and active-ruleset lifecycle for that catalog.

#### Scenario: Startup import activates the current workbook ruleset
- **WHEN** `web-backend` starts with MML rule import enabled and the configured rule directory contains a workbook named in the `CHECK_RULE_<networkType>_<networkVersion>_MARCO_RULE.xlsx` form
- **THEN** the service MUST parse the `CHECK_RULE` sheet from that workbook
- **AND** the service MUST persist the imported commands and parameters into a dedicated MML rule database owned by `web-backend`

#### Scenario: Unchanged workbook is skipped by checksum
- **WHEN** `web-backend` scans a workbook whose content checksum matches the active imported ruleset for the same `networkType + networkVersion`
- **THEN** the service MUST avoid rebuilding that ruleset
- **AND** the existing active rule data for that `networkType + networkVersion` MUST remain queryable without duplication

#### Scenario: Changed workbook replaces the active ruleset transactionally
- **WHEN** `web-backend` scans a workbook for a `networkType + networkVersion` whose checksum differs from the active imported ruleset
- **THEN** the service MUST import the new workbook content transactionally
- **AND** it MUST promote the new imported ruleset as the active ruleset for that `networkType + networkVersion`

### Requirement: Web backend SHALL expose the canonical authenticated MML schema route
The web backend SHALL expose canonical MML schema lookup at `/web/api/mml/schema` and SHALL require the existing authenticated web session context for access.

#### Scenario: Authenticated schema lookup returns imported rule metadata
- **WHEN** an authenticated client requests `/web/api/mml/schema` with a `networkType` and `networkVersion` that match an active imported ruleset
- **THEN** `web-backend` MUST return command-level and parameter-level metadata assembled from the imported rule catalog
- **AND** the response MUST preserve the normalized schema contract needed by the current workbench consumers

#### Scenario: Missing ruleset returns no schema without fabricating data
- **WHEN** an authenticated client requests `/web/api/mml/schema` for a `networkType + networkVersion` that has no active imported ruleset
- **THEN** `web-backend` MUST return no schema for that lookup
- **AND** the service MUST NOT fabricate workbook rule data that is not backed by an imported ruleset

#### Scenario: Unauthenticated schema lookup is rejected
- **WHEN** a client requests `/web/api/mml/schema` without a valid authenticated web session
- **THEN** `web-backend` MUST reject that request using the existing auth enforcement path
- **AND** the route MUST NOT expose the canonical MML schema anonymously
