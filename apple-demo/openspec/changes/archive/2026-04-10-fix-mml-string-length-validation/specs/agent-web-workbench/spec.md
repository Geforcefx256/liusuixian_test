## ADDED Requirements

### Requirement: Workbench SHALL 仅按最小长度和最大长度校验字符串参数
The workbench SHALL treat backend MML schema as the shared semantic source for text and table editing, and for string parameters it MUST validate values only against `minLength` and `maxLength` rather than using `exactLength`.

#### Scenario: Text diagnostics ignore historical exact string length
- **WHEN** the user edits an MML string parameter in text view and the loaded schema for that parameter contains `minLength`、`maxLength`, and a historical `exactLength`
- **THEN** the workbench MUST continue to enforce the configured minimum and maximum string length bounds
- **AND** it MUST NOT emit a string-length diagnostic solely because the current value does not equal that historical `exactLength`

#### Scenario: Workbook cell validation follows the same string length rule
- **WHEN** the user edits a known string parameter cell in MML table view and the loaded schema for that parameter contains `minLength`、`maxLength`, and a historical `exactLength`
- **THEN** the workbench MUST validate that cell only against the configured minimum and maximum string length bounds
- **AND** it MUST NOT block the edit solely because the new value does not equal that historical `exactLength`
