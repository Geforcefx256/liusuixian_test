## ADDED Requirements

### Requirement: Workbench SHALL render MML table view as a workbook shell with a fixed summary sheet
The workbench SHALL render the MML table view as a workbook shell where `汇总` is a dedicated summary sheet that is always shown as the leftmost tab and where command-sheet grids appear only when a non-summary tab is active.

#### Scenario: Summary sheet is always the leftmost workbook tab
- **WHEN** the user opens an MML-capable workspace file in table view
- **THEN** the workbook tab row MUST render a `汇总` tab at the far left
- **AND** command-sheet tabs discovered from parsed command heads MUST render to the right of that fixed summary tab

#### Scenario: Summary tab owns summary content instead of a top-of-grid banner
- **WHEN** the active workbook tab is `汇总`
- **THEN** the workbench MUST render the MML summary content inside the sheet body for that tab
- **AND** the command-sheet grid MUST NOT render at the same time as a separate banner-above-grid summary surface

#### Scenario: Command-sheet tab focuses the workbook body on the active sheet grid
- **WHEN** the user activates a command-sheet tab such as `ADD RULE`
- **THEN** the workbench MUST render only the active command-sheet grid in the workbook body
- **AND** any sheet-level status summary MUST move to the bottom status bar rather than remain as extra page chrome above the grid

### Requirement: Workbench SHALL use a spreadsheet-style grid for active MML command sheets
The workbench SHALL render each active MML command sheet through a spreadsheet-style grid engine that supports bounded Excel-like interactions within the product's current dependency constraints.

#### Scenario: Active command sheet supports rectangular selection and standard clipboard actions
- **WHEN** the user interacts with an active MML command sheet in table view
- **THEN** the grid MUST support one rectangular active selection with keyboard navigation
- **AND** the workbench MUST support standard copy and paste behavior for editable target ranges on that active sheet

#### Scenario: Schema-driven enum parameters use spreadsheet dropdown editors
- **WHEN** an active MML command sheet includes a known parameter whose schema control type is `select`
- **THEN** the grid MUST present that cell through a dropdown-style spreadsheet editor
- **AND** known non-enum parameters MAY use text-style spreadsheet editors as long as they still obey the schema-driven editability rules

#### Scenario: Workbook status bar reflects active sheet and selection feedback
- **WHEN** the user focuses or changes selection inside an active MML command sheet
- **THEN** the bottom workbook status bar MUST reflect the active sheet and the current cell or rectangular selection
- **AND** blocked-edit or read-only fallback feedback MUST be surfaced in that status bar without requiring a persistent banner above the grid

### Requirement: Workbench SHALL preserve conservative MML editability and text-first round-tripping during spreadsheet interactions
The workbench SHALL continue to treat MML text as the only document authority even when the active command sheet is rendered through a spreadsheet grid.

#### Scenario: Read-only rows remain blocked in spreadsheet editing flows
- **WHEN** a user attempts to edit or paste into a cell that belongs to a read-only MML row or an otherwise non-editable target
- **THEN** the workbench MUST block that spreadsheet edit
- **AND** the workbench MUST preserve the existing fallback rule that the user switches to text view when that row needs modification

#### Scenario: Safe spreadsheet edits rewrite only the targeted MML statement text
- **WHEN** the user applies a valid spreadsheet edit to a safe editable MML cell
- **THEN** the workbench MUST route that change back through the MML projection and statement-level rewrite path
- **AND** the saved file content MUST continue to preserve untouched comments, blank lines, statement order, and other non-edited text segments

#### Scenario: Batch paste degrades conservatively when the target rectangle is not fully safe
- **WHEN** the user pastes a rectangular value range into an active MML command sheet
- **AND** any targeted cell would require editing a read-only row, an unknown-parameter area, or another unsupported target
- **THEN** the workbench MUST reject that spreadsheet paste operation rather than silently applying only part of it
- **AND** the underlying MML text content MUST remain unchanged by that blocked paste
