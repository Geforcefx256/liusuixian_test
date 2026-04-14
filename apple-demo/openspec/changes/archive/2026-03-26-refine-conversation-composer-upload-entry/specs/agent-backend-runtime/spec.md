## ADDED Requirements

### Requirement: Runtime SHALL enforce the governed workbench composer upload contract
The runtime SHALL enforce the file-format contract exposed by the authenticated workbench composer so that accepted uploads become reusable workspace entries and unsupported uploads fail explicitly.

#### Scenario: Composer upload accepts governed text and table formats
- **WHEN** a client uploads a `.txt`, `.md`, or `.csv` file through the authenticated workbench composer flow
- **THEN** the runtime MUST accept that file into the current `user + agent` workspace
- **AND** the resulting upload MUST remain available through the existing reusable workspace-entry and file-open flows

#### Scenario: Unsupported composer upload is rejected explicitly
- **WHEN** a client uploads a file with an unsupported extension through the same composer upload flow
- **THEN** the runtime MUST reject that upload with an explicit validation failure
- **AND** the runtime MUST NOT create a reusable workspace entry for the rejected file

#### Scenario: Accepted txt uploads remain compatible with later MML-aware file opening
- **WHEN** the runtime accepts a `.txt` upload from the composer flow
- **THEN** the stored workspace file MUST remain compatible with the existing plain-text and MML-aware open-path rules
- **AND** the governed composer contract MUST still be expressed to users as `TXT / MD / CSV` rather than as a separate `MML` upload class
