## ADDED Requirements

### Requirement: Runtime SHALL import fixed backend MML rule workbooks into a dedicated rule database
The runtime SHALL treat fixed backend Excel workbooks as the primary MML rule source and SHALL import those workbooks into a dedicated backend rule database keyed by `networkType + networkVersion`.

#### Scenario: Startup import activates the current workbook ruleset
- **WHEN** the backend starts with MML rule import enabled and the configured rule directory contains a workbook named in the `CHECK_RULE_<networkType>_<networkVersion>_MARCO_RULE.xlsx` form
- **THEN** the runtime MUST parse the `CHECK_RULE` sheet from that workbook
- **AND** the runtime MUST persist the imported commands and parameters into a dedicated MML rule database rather than serving rule data only from in-memory stub constants

#### Scenario: Unchanged workbook is skipped by checksum
- **WHEN** the backend scans a workbook whose content checksum matches the currently active imported ruleset for the same `networkType + networkVersion`
- **THEN** the runtime MUST avoid rebuilding the active ruleset for that workbook
- **AND** the active rule data for that `networkType + networkVersion` MUST remain queryable without duplication

#### Scenario: Changed workbook replaces the active ruleset
- **WHEN** the backend scans a workbook for a `networkType + networkVersion` whose checksum differs from the currently active imported ruleset
- **THEN** the runtime MUST import the new workbook content transactionally
- **AND** it MUST promote the new imported ruleset as the active ruleset for that `networkType + networkVersion`

### Requirement: Runtime SHALL expose richer MML rule schema for shared text and table consumers
The runtime SHALL expose MML rule data through the existing `/agent/api/files/mml-schema` route as one shared schema surface for both workbook-style table projection and Monaco-backed text assistance.

#### Scenario: Schema lookup returns workbook-backed command and parameter metadata
- **WHEN** a client requests `/agent/api/files/mml-schema` with a `networkType` and `networkVersion` that match an active imported ruleset
- **THEN** the runtime MUST return command and parameter metadata assembled from the imported rule database
- **AND** the response MUST preserve the current table-view-compatible fields needed by the workbench workbook projection path

#### Scenario: Schema lookup includes richer parameter semantics for editor assistance
- **WHEN** the runtime returns MML schema data for an imported ruleset
- **THEN** each parameter MAY include richer metadata such as normalized required mode, conditional rules, enum values, composite flag-set options, numeric constraints, length constraints, value format hints, and case-sensitivity flags
- **AND** the richer metadata MUST be structured so text-mode completion, text diagnostics, and workbook-style typed cell editing can consume the same schema surface without reading the original Excel workbook directly

#### Scenario: Unsupported network combinations remain unavailable without leaking stub-only behavior
- **WHEN** a client requests `/agent/api/files/mml-schema` for a `networkType + networkVersion` that has no active imported ruleset
- **THEN** the runtime MUST return no MML schema for that lookup
- **AND** the runtime MUST NOT invent workbook rule data that is not backed by an imported ruleset
