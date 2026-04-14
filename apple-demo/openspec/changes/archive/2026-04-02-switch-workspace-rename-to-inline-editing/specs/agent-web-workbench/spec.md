## MODIFIED Requirements

### Requirement: Workbench SHALL support explicit workspace file rename from the row action menu
The workbench SHALL let users explicitly rename workspace files from the right-side workspace sidebar row action menu while preserving the existing file-row selection and open interactions. Triggering rename from that menu MUST switch the current file row into an inline rename state instead of opening a browser prompt or detached dialog.

#### Scenario: Row action menu exposes rename alongside existing secondary actions
- **WHEN** the user opens the secondary action menu for a workspace file in the `工作空间` sidebar tree
- **THEN** the menu MUST expose a `重命名` action in addition to the existing secondary file actions
- **AND** using the secondary action menu MUST NOT also trigger file selection or file opening

#### Scenario: Rename starts as inline editing on the same file row
- **WHEN** the user triggers workspace file rename from the row action menu
- **THEN** the workbench MUST replace only the file-name display region on that row with an inline editing control
- **AND** the workbench MUST NOT move the rename interaction into a browser prompt, modal, or detached form surface

#### Scenario: Inline rename does not widen rename scope beyond v1 constraints
- **WHEN** the user edits a file name inline from the workspace row
- **THEN** the workbench MUST collect only a basename change for that file rather than a directory path
- **AND** the frontend MUST NOT offer UI affordances for changing the parent directory or extension as part of v1 rename

### Requirement: Workbench SHALL restrict workspace rename input to the editable file name stem
The workbench SHALL present workspace file rename as a stem-only inline edit operation. The frontend MUST preserve the existing extension for supported workspace files, MUST submit the recomposed full file name to the backend rename API, and MUST provide explicit keyboard and focus semantics for completing or cancelling the inline edit.

#### Scenario: Inline rename defaults to the current file name stem
- **WHEN** the user triggers rename for a workspace file whose current name is `input.csv`
- **THEN** the rename interaction MUST present `input` as the editable inline value rather than `input.csv`
- **AND** the interaction MUST indicate that the existing `.csv` extension is preserved as a non-editable suffix on the same row

#### Scenario: Enter or blur submits the recomposed file name
- **WHEN** the user renames `input.csv` by entering the new stem `input-renamed`
- **AND** the user confirms with `Enter` or ends the inline edit by moving focus away from that control
- **THEN** the frontend MUST call the backend rename API with the full file name `input-renamed.csv`
- **AND** the workbench MUST continue to show the renamed file as `input-renamed.csv` after the rename succeeds

#### Scenario: Escape cancels inline rename without issuing a request
- **WHEN** the user is editing a workspace file name inline
- **AND** the user presses `Escape`
- **THEN** the workbench MUST exit the inline rename state for that row
- **AND** the frontend MUST NOT issue a rename request for that cancellation path

#### Scenario: Unchanged inline rename exits without issuing a request
- **WHEN** the user finishes inline rename without changing the editable stem value
- **THEN** the workbench MUST exit the inline rename state
- **AND** the frontend MUST NOT issue a rename request for that no-op path

#### Scenario: Files without an extension remain fully editable
- **WHEN** the user triggers rename for a workspace file whose current name has no extension
- **THEN** the rename interaction MUST allow editing the full current name inline
- **AND** the frontend MUST submit the edited value without appending an extension
