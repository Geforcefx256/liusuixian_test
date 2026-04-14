## ADDED Requirements

### Requirement: Workbench SHALL present normalized readable text for uploaded workspace files
The workbench SHALL rely on the runtime's UTF-8-normalized upload contract so that supported uploaded text files open as readable text in the workspace editor without requiring the user to repair encoding manually.

#### Scenario: Chinese upload opens without mojibake
- **WHEN** a user uploads a supported Chinese text file encoded as UTF-8, UTF-16 with BOM, or GB18030-family text and then opens it from the workspace sidebar
- **THEN** the workbench MUST render readable Chinese text in the workspace editor
- **AND** the user MUST be able to continue editing and saving that file through the normal workspace flow

#### Scenario: Normalized upload remains readable after save and reopen
- **WHEN** a user opens an uploaded text file that was normalized to UTF-8 during upload, saves edits, closes it, and later reopens it
- **THEN** the workbench MUST continue to render readable text for that same workspace file
- **AND** the workbench MUST NOT require the user to choose or reapply an encoding setting during the normal workspace flow

#### Scenario: Unsupported encoded upload does not enter editor flow
- **WHEN** the runtime rejects an uploaded supported file because the content encoding is unsupported or not valid text
- **THEN** the workbench MUST surface the upload failure instead of showing a garbled editor view for that file
- **AND** the rejected file MUST NOT appear as a successfully opened editable workspace file
