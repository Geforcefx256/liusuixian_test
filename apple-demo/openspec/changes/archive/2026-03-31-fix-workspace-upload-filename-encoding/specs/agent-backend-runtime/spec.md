## MODIFIED Requirements

### Requirement: Uploaded files SHALL become reusable workspace entries for the current `user + agent` workspace
The runtime SHALL treat uploaded files as reusable read-only workspace entries so that uploaded assets can appear in the workspace sidebar, preserve their original filenames, and participate in later workspace-opening flows across sessions for the same `user + agent` workspace.

#### Scenario: Upload response can be associated with the active agent workspace
- **WHEN** a user uploads one or more supported files for the active workbench flow
- **THEN** the runtime MUST return metadata that can be associated with the current `user + agent` workspace
- **AND** the frontend MUST be able to place those uploaded assets into the workspace sidebar without inventing transient identifiers client-side

#### Scenario: Uploaded entry preserves original filename and opens with the correct mode
- **WHEN** a user uploads a supported text, Markdown, or CSV file for the active workbench flow
- **THEN** the resulting workspace entry MUST preserve the original filename shown to the user
- **AND** opening that entry later MUST still resolve the supported editor mode appropriate for that file content

#### Scenario: UTF-8 multipart filename remains readable across the workspace flow
- **WHEN** a client uploads a supported file whose multipart filename parameter contains UTF-8 characters such as Chinese
- **THEN** the runtime MUST preserve that user-visible filename without mojibake in the upload response, workspace metadata, and later file-open payloads
- **AND** the stored workspace entry MUST remain reachable through the normal scoped upload path derived from that readable filename

#### Scenario: Different sessions can recover the same uploaded workspace entries
- **WHEN** the user opens different persisted sessions for the same active agent
- **THEN** the runtime MUST allow the frontend to recover the same `user + agent` workspace entries for sidebar rendering across those sessions
