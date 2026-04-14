## MODIFIED Requirements

### Requirement: Workbench SHALL provide schema-driven Monaco assistance for MML text view
The workbench SHALL use the loaded backend MML rule schema to provide Monaco-style MML editing assistance, including command completion, parameter completion, value suggestions, and validation feedback, while preserving file content as the editing authority.

#### Scenario: Command and parameter completion follow the active MML rule schema
- **WHEN** the user edits an MML-capable workspace file in text view and Monaco has loaded rule schema for the current `networkType + networkVersion`
- **THEN** the editor MUST suggest command heads, parameter names, and parameter values from that schema according to the current statement context
- **AND** parameter suggestions MUST respect declared parameter ordering and already-entered parameters for the active statement

#### Scenario: Value suggestions follow schema value semantics
- **WHEN** the user requests or triggers completion while editing a parameter value in MML text view
- **THEN** enum-style parameters MUST suggest schema enum values
- **AND** string-like, numeric, IP-like, and composite-flag-set-style parameters MUST use schema value hints to choose an appropriate insertion form, snippet shape, or structured edit action

#### Scenario: Text view can open a structured editor for composite flag-set values
- **WHEN** the user places the cursor inside a composite-flag-set-style parameter value in MML text view
- **THEN** the workbench MUST expose a structured edit action that lets the user toggle the declared options for that parameter
- **AND** applying that structured edit MUST replace only the current parameter value text using canonical schema order and enabled-option-only serialization
- **AND** cancelling that structured edit MUST leave the underlying MML text unchanged

#### Scenario: Monaco diagnostics reflect schema-driven rule violations
- **WHEN** the user edits an MML-capable workspace file in text view with schema available
- **THEN** the workbench MUST surface schema-driven validation feedback for issues such as unknown parameters, duplicate parameters, invalid enum values, or missing conditionally required parameters
- **AND** that feedback MUST remain advisory to the text editor path rather than replacing the file content as the source of truth

#### Scenario: Inactive conditional requirements do not produce false-positive diagnostics
- **WHEN** the active statement omits a conditionally required parameter and the schema trigger condition for that parameter is not satisfied
- **THEN** the text view MUST NOT report that parameter as a missing required diagnostic
- **AND** Monaco markers MUST remain absent for that inactive conditional rule

## ADDED Requirements

### Requirement: Workbench SHALL provide discoverable MML diagnostic feedback in text view
The workbench SHALL make active MML text-view diagnostics discoverable beyond wave-underlines alone so users can understand the current file state without relying on implicit Monaco behavior.

#### Scenario: Hovering a marked range explains the active diagnostic
- **WHEN** the user hovers a text range that currently carries an MML diagnostic marker
- **THEN** the workbench MUST show hover content that explains the active diagnostic message for that range
- **AND** any schema help shown for the same position MUST appear as supporting context rather than replacing the diagnostic explanation

#### Scenario: Text view exposes a file-level diagnostic summary
- **WHEN** the active MML text view has one or more diagnostics
- **THEN** the workbench MUST surface a file-level diagnostic summary in the editor shell
- **AND** that summary MUST include the active diagnostic count and severity mix at least at the warning/error level

#### Scenario: User can inspect diagnostics from an expandable summary surface
- **WHEN** the user activates the text-view diagnostic summary
- **THEN** the workbench MUST expand a dedicated diagnostic list for the active file
- **AND** each diagnostic entry MUST show enough information to distinguish the affected statement and issue message

#### Scenario: Selecting a diagnostic entry returns the user to the affected text
- **WHEN** the user selects an entry from the text-view diagnostic list
- **THEN** the editor MUST move focus to the corresponding text range
- **AND** the workbench MUST keep the diagnostics advisory rather than blocking editing or saving
