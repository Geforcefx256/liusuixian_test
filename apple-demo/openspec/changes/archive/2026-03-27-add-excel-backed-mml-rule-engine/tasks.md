## 1. Backend Rule Import And Storage

- [x] 1.1 Add backend config support for fixed MML rule workbook directory and dedicated rule DB path.
- [x] 1.2 Add the Excel parsing dependency and implement workbook filename parsing plus `CHECK_RULE` sheet loading.
- [x] 1.3 Create the dedicated SQLite rule store, schema initialization, checksum tracking, and active-ruleset replacement flow.
- [x] 1.4 Normalize Excel row data into commands, parameters, enum values, bitfield options, and conditional rules while preserving raw source values for traceability.
- [x] 1.5 Bootstrap workbook import during backend startup with clear logging and configurable startup failure behavior.

## 2. Runtime Schema Query Surface

- [x] 2.1 Replace the hardcoded MML schema stub lookup with a DB-backed schema service queried by `networkType + networkVersion`.
- [x] 2.2 Keep `/agent/api/files/mml-schema` compatible with the current workbook table path while extending parameter payloads with richer metadata for text assistance.
- [x] 2.3 Update files-route construction so the MML schema service is injected cleanly from backend startup wiring.
- [x] 2.4 Add backend tests for filename parsing, checksum skipping, active-ruleset replacement, condition parsing, and DB-backed schema route responses.

## 3. Frontend Shared MML Semantics And Workbook Editing

- [x] 3.1 Extract shared MML parsing helpers from the workbook code so text view and table view use the same statement and parameter semantics.
- [x] 3.2 Update frontend MML schema types to include optional richer metadata fields returned by the backend.
- [x] 3.3 Keep the workbook summary-sheet and command-sheet projection path working against the shared imported rule schema.
- [x] 3.4 Add schema-aware workbook editors and validation for enum and integer columns without breaking the text-first rewrite model.
- [x] 3.5 Add a template-guided workbook editing path for composite flag-set parameters that generates canonical serialized text from declared options.
- [x] 3.6 Ensure composite flag-set workbook edits serialize in stable schema order and round-trip back into canonical MML text.
- [x] 3.7 Add regression tests proving the workbook-style table view still projects sheets, columns, typed editors, composite flag-set serialization, and conservative editability from the shared schema.

## 4. Monaco Text Assistance

- [x] 4.1 Pass loaded MML schema metadata into the Monaco-backed workspace text editor for MML files.
- [x] 4.2 Implement schema-driven Monaco completion for command heads, parameter names, and parameter values.
- [x] 4.3 Add a structured Monaco edit action for composite flag-set values that reuses the same option model and canonical serialization rules as workbook mode.
- [x] 4.4 Implement schema-driven hover details and diagnostics for unknown keys, duplicates, invalid enum values, invalid composite flag-set values, and missing conditional required parameters.
- [x] 4.5 Add frontend tests for MML completion context detection, suggestion ordering, insertion behavior, structured composite editing, and schema-driven diagnostics.

## 5. End-To-End Verification

- [x] 5.1 Verify one imported Excel ruleset powers both MML text assistance and workbook table projection for the same `networkType + networkVersion`.
- [x] 5.2 Verify missing schema keeps plain text editing available while blocking schema-driven table projection and advanced editor assistance consistently.
- [x] 5.3 Verify dist/runtime packaging still includes the dependencies and configuration needed for backend rule import in built deployments.
