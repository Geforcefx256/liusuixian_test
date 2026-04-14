## ADDED Requirements

### Requirement: Workbench SHALL present the MML workbook shell with Excel-like worksheet visual hierarchy
The workbench SHALL present MML table view with an Excel-like worksheet shell so users perceive the area as one workbook surface rather than as generic application tabs above an embedded grid.

#### Scenario: Sheet tabs read as worksheet tabs instead of pill-style navigation
- **WHEN** the user opens an MML-capable workspace file in table view
- **THEN** the workbook tab row MUST present `汇总` and command-sheet entries as worksheet-style tabs that visually belong to the workbook shell
- **AND** inactive tabs MUST use a low-emphasis state rather than reading as high-prominence pill buttons or primary navigation actions

#### Scenario: Active sheet surface is visually connected to the tab strip
- **WHEN** the user views either the `汇总` sheet or an active command sheet in MML table view
- **THEN** the tab strip and active sheet body MUST read as one connected workbook surface through aligned borders, spacing, and container treatment
- **AND** the shell MUST NOT present the active grid area as an unrelated floating card beneath a separate tab control

#### Scenario: Summary and command sheets stay within the same workbook language
- **WHEN** the user switches between `汇总` and any command-sheet tab in MML table view
- **THEN** both views MUST preserve the same workbook-shell visual language at the outer container level
- **AND** the summary view MUST NOT feel like leaving the workbook for a separate dashboard-style page chrome treatment
