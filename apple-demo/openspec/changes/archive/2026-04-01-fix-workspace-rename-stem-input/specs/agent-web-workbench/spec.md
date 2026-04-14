## ADDED Requirements

### Requirement: Workbench SHALL restrict workspace rename input to the editable file name stem
The workbench SHALL present workspace file rename as a stem-only edit operation. The frontend MUST preserve the existing extension for supported workspace files and MUST submit the recomposed full file name to the backend rename API.

#### Scenario: Rename prompt defaults to the current file name stem
- **WHEN** the user triggers rename for a workspace file whose current name is `input.csv`
- **THEN** the rename interaction MUST present `input` as the editable value rather than `input.csv`
- **AND** the interaction MUST indicate that the existing `.csv` extension is preserved

#### Scenario: Rename submission recomposes the original extension
- **WHEN** the user renames `input.csv` by entering the new stem `input-renamed`
- **THEN** the frontend MUST call the backend rename API with the full file name `input-renamed.csv`
- **AND** the workbench MUST continue to show the renamed file as `input-renamed.csv` after the rename succeeds

#### Scenario: Files without an extension remain fully editable
- **WHEN** the user triggers rename for a workspace file whose current name has no extension
- **THEN** the rename interaction MUST allow editing the full current name
- **AND** the frontend MUST submit the edited value without appending an extension
