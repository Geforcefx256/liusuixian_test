## ADDED Requirements

### Requirement: Workbench SHALL expose spare rows for active MML command sheets without changing text authority
The workbench SHALL render each active MML command sheet with a visible spare-row region so users can continue authoring beyond the current persisted statement count while MML text remains the only saved document authority.

#### Scenario: Active command sheet shows spare rows after persisted statement rows
- **WHEN** the user opens an active MML command sheet in table view
- **THEN** the grid MUST render the persisted statement rows already projected from source text
- **AND** the grid MUST also render a visible spare-row region below those persisted rows so the sheet does not visually end at the last existing statement

#### Scenario: Selecting a spare row explains table-based new-row authoring behavior
- **WHEN** the user selects a cell in the spare-row region of an active MML command sheet
- **THEN** the workbook status feedback MUST indicate that input in that region is used to author a new statement for the active command sheet
- **AND** the workbench MUST NOT treat that spare row as an already-persisted MML statement before a valid edit or paste is committed

#### Scenario: Direct single-cell input into spare rows stays local until the row is valid
- **WHEN** the user focuses a spare-row cell in an active MML command sheet and enters a value through direct typing, paste, or deletion
- **THEN** the workbench MUST allow that edit to update the table-visible new-row state for the targeted row
- **AND** the workbench MUST preserve the underlying MML text unchanged until that row becomes complete and valid under the active sheet schema

#### Scenario: Spare rows and incomplete new rows do not create saved statements by merely being visible
- **WHEN** the user opens or scrolls through a command sheet that shows spare rows, or leaves a spare-row-backed new row incomplete in table view
- **THEN** the underlying MML text content MUST remain unchanged
- **AND** those spare rows or incomplete new rows MUST NOT be serialized as empty, partial, or placeholder statements on save

### Requirement: Workbench SHALL keep incomplete new-row authoring local to the table view
The workbench SHALL allow users to author new MML rows in table view without auto-filling untouched parameters, while keeping incomplete rows as table-local state until they become valid statements.

#### Scenario: Partial input into a spare row records only the touched columns
- **WHEN** the user edits or pastes only a subset of columns for a new row in the spare-row region
- **THEN** the workbench MUST preserve only the values explicitly provided for that new row
- **AND** the workbench MUST NOT auto-fill untouched parameters, schema defaults, or values inferred from other rows or columns

#### Scenario: Missing required parameters are indicated without synthesizing values
- **WHEN** a table-authored new row is missing an unconditional required parameter or a conditional-required parameter
- **THEN** the workbench MUST surface that row as incomplete in table view
- **AND** the workbench MUST visually indicate the missing requirement on the affected row or cells
- **AND** the workbench MUST NOT synthesize or write parameter values on the user's behalf in order to make that row pass validation

#### Scenario: Incomplete new rows survive tab switching inside the current workspace session
- **WHEN** the user leaves a table-authored new row incomplete and switches command tabs, file tabs, or view modes within the current workspace session
- **THEN** the workbench MUST preserve that incomplete new-row state when the user returns to the same file and command sheet

#### Scenario: Save is blocked while incomplete new rows remain
- **WHEN** the active workspace contains one or more incomplete table-authored new rows
- **AND** the user attempts to save the file
- **THEN** the workbench MUST block that save
- **AND** the workbench MUST explain that incomplete table rows must be completed or cleared before save can proceed

### Requirement: Workbench SHALL support transactional MML paste that can update existing rows and append new statements
The workbench SHALL treat spreadsheet paste into an active MML command sheet as one table-authoritative interaction that may update existing persisted rows immediately and may also advance spare-row-backed new rows toward materialization, while MML text remains the only saved document authority.

#### Scenario: Paste may update persisted rows and create additional rows in one operation
- **WHEN** the user pastes a rectangular value range into an active MML command sheet
- **AND** part of the target rectangle maps to existing persisted rows while another part maps to spare rows
- **THEN** the workbench MUST allow that paste to proceed as one operation when all targeted cell values are valid for their target columns
- **AND** the persisted-row portion MUST update the existing statements through the text-first rewrite path
- **AND** the spare-row portion MUST either materialize complete valid statements or remain as incomplete table-local new-row state for the active command sheet

#### Scenario: New rows materialize only explicit values and append in row order once complete
- **WHEN** the user edits or pastes values that make one or more spare-row-backed new rows complete and valid in an active command sheet
- **THEN** the workbench MUST evaluate those new rows using only the values explicitly present in the table for each row together with unconditional required parameters and conditional-required parameters
- **AND** blank cells for those new rows MUST be treated as not-provided values rather than as explicit empty overrides
- **AND** successfully materialized new statements MUST append after the last existing statement of that active command sheet
- **AND** those new statements MUST insert before any consecutive raw segment that already followed that last matching statement
- **AND** multiple new statements that become materializable together MUST append in the same top-to-bottom order as their table rows

#### Scenario: Paste rejects hard validation failures but does not reject merely incomplete new rows
- **WHEN** the user pastes a rectangular value range into an active MML command sheet
- **AND** any targeted persisted row is blocked, any typed value fails validation, or the target rectangle exceeds the available command-sheet range
- **THEN** the workbench MUST reject the entire paste operation
- **AND** the underlying MML text content MUST remain unchanged
- **AND** the workbench MUST NOT silently apply only the valid subset of that paste
- **BUT** the workbench MUST NOT treat a spare-row-backed new row as a hard paste failure solely because that row remains incomplete after the paste

#### Scenario: Typed clipboard values use canonical target-column semantics
- **WHEN** the user copies from or pastes into schema-driven typed cells such as enum, numeric, or composite/bitfield parameters in an active MML command sheet
- **THEN** the workbench MUST interpret pasted text according to the target column schema rather than according to any source-grid UI state
- **AND** enum cells MUST copy and paste their canonical schema values rather than display labels
- **AND** composite or bitfield cells MUST copy and paste canonical serialized values that are revalidated and normalized against the target column schema before save
