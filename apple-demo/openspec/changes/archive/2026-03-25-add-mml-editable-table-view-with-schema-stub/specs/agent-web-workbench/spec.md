## ADDED Requirements

### Requirement: Workbench SHALL provide a structured MML table view alongside the text view
The workbench SHALL allow an MML-capable workspace file to switch between the existing text view and a structured table view that projects the MML document as workbook-style command sheets without replacing text as the document authority.

#### Scenario: MML-capable file can enter workbook-style table view
- **WHEN** the user opens an MML-capable workspace file and chooses table view
- **THEN** the workbench MUST render a workbook-style MML table surface inside the central workspace editor region
- **AND** the workbench MUST keep the standard conversation-led shell and MML toolbar controls around that table surface

#### Scenario: Structured table view groups statements by full command head
- **WHEN** the table view parses an MML-capable file that contains multiple command statements
- **THEN** the workbench MUST group rows into sheets keyed by the full command head before `:`
- **AND** each row in a command sheet MUST represent one complete MML statement rather than an arbitrary visual line

#### Scenario: Summary view exposes command-sheet discovery
- **WHEN** the user enters MML table view for a parsed workbook
- **THEN** the workbench MUST provide a summary-oriented workbook landing surface that helps the user discover available command sheets
- **AND** the user MUST be able to navigate from that summary surface into an individual command sheet

### Requirement: Workbench SHALL keep MML table editing conservative and text-first
The workbench SHALL treat the MML table view as a structured projection of text and SHALL allow edits only where the underlying statement can be rewritten safely.

#### Scenario: Safe known-parameter cells can be edited through schema-driven controls
- **WHEN** a parsed MML row is structurally safe and the loaded schema marks a parameter as editable
- **THEN** the workbench MUST allow the user to edit that parameter in the table view
- **AND** enum-like parameters MUST be able to use schema-driven select-style controls in the table

#### Scenario: Unknown or unsafe rows degrade to read-only
- **WHEN** a parsed MML row contains unknown parameters, duplicate parameters, unsupported syntax, ambiguous comment binding, or other unsafe rewrite conditions
- **THEN** the workbench MUST make that row read-only in the table view
- **AND** the user MUST be directed to use text view when that row needs modification

#### Scenario: Table edits preserve text-authoritative save behavior
- **WHEN** the user edits a safe MML cell in table view and then saves the file
- **THEN** the workbench MUST rewrite only the targeted statement text back into the underlying MML content
- **AND** untouched comments, blank lines, statement order, and untouched raw text segments MUST remain preserved

### Requirement: Workbench SHALL expose schema loading state in MML table view
The workbench SHALL load MML command parameter schema using the current `网元类型` and `网元版本` and SHALL degrade the MML table view conservatively when schema is unavailable.

#### Scenario: Available schema enables schema-aware columns
- **WHEN** the current MML metadata resolves to an available schema response
- **THEN** the table view MUST use that schema to determine known parameter columns, column order, control types, and editability
- **AND** the workbench MUST surface that schema-ready state to the user

#### Scenario: Missing or failed schema keeps the table readable but non-editable
- **WHEN** schema loading is unavailable or fails for the active MML metadata
- **THEN** the workbench MUST keep the structured table projection readable where parsing succeeds
- **AND** the workbench MUST degrade table editing to read-only rather than guessing schema-driven behavior
