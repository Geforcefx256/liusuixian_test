## MODIFIED Requirements

### Requirement: Workbench SHALL use one backend MML rule schema across text and table editing
The workbench SHALL treat the canonical web-backend MML schema lookup as the shared semantic source for both Monaco-backed MML text editing and workbook-style MML table projection.

#### Scenario: Text and table modes resolve the same network-version rule set
- **WHEN** the user opens an MML-capable workspace file whose toolbar metadata identifies a `networkType` and `networkVersion`
- **THEN** the workbench MUST load one backend MML schema for that `networkType + networkVersion`
- **AND** it MUST fetch that schema from the canonical `/web/api/mml/schema` route rather than through `agent-backend`'s `/agent/api/files/mml-schema` compatibility path
- **AND** both the Monaco text path and the MML workbook table path MUST consume that same loaded schema rather than maintaining separate rule catalogs

#### Scenario: Table mode continues to project workbook sheets from the shared schema
- **WHEN** the user enters MML table view for a file whose backend rule schema is available
- **THEN** the workbench MUST continue to build workbook sheets, columns, and editability rules from the loaded schema
- **AND** replacing the schema transport path with the canonical web route MUST NOT remove the current workbook-style summary sheet and command-sheet interaction model

#### Scenario: Typed workbook columns use schema-aware editors and bounded values
- **WHEN** an active MML command sheet includes a known parameter whose loaded schema identifies enum values, integer constraints, or composite flag-set options
- **THEN** the table view MUST use a schema-aware cell editing behavior for that column
- **AND** enum-style columns MUST present a dropdown-style editor and reject values outside the declared enum set
- **AND** integer-style columns MUST reject values that violate the schema rules the current workbook path understands for that type
- **AND** composite-flag-set-style columns MUST use a template-guided editing path that helps the user compose a valid serialized value from the declared option set rather than requiring fully manual free-text authoring

#### Scenario: Composite flag-set workbook editor serializes stable MML text from structured choices
- **WHEN** the user edits a composite-flag-set-style parameter in an active MML command sheet
- **THEN** the workbench MUST present each declared option as a structured enabled or disabled choice within the table-editing flow
- **AND** confirming that edit MUST serialize only the enabled options back into canonical MML text using the declared option order
- **AND** the underlying workbook rewrite path MUST continue to persist the serialized composite value text back through the text-first document authority model

#### Scenario: Missing schema blocks both advanced text assistance and table projection consistently
- **WHEN** the workbench cannot load backend MML schema for the current `networkType + networkVersion`
- **THEN** the workbench MUST keep MML text editing available as plain text entry
- **AND** it MUST withhold schema-driven table projection and schema-driven editor assistance until that rule schema becomes available
