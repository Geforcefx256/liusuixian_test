## ADDED Requirements

### Requirement: Uploaded text files SHALL be normalized to UTF-8 before workspace persistence
The runtime SHALL detect the source encoding of supported uploaded text files and SHALL persist the normalized file content as UTF-8 within the scoped workspace upload store.

#### Scenario: UTF-8 text upload remains readable after persistence
- **WHEN** a user uploads a supported text, Markdown, CSV, or MML file whose content is already valid UTF-8
- **THEN** the runtime MUST persist that file as UTF-8 text in the scoped workspace upload path
- **AND** later open, save, and download flows MUST read back the same readable text content without mojibake

#### Scenario: BOM-prefixed Unicode text upload is normalized to UTF-8
- **WHEN** a user uploads a supported text file encoded as UTF-8 with BOM, UTF-16LE with BOM, or UTF-16BE with BOM
- **THEN** the runtime MUST detect the BOM-backed source encoding before workspace persistence
- **AND** the runtime MUST store the resulting file content as UTF-8 text without preserving the original BOM encoding in workspace storage

#### Scenario: GB18030-family Chinese text upload is normalized to UTF-8
- **WHEN** a user uploads a supported text file whose content is not valid UTF-8 but is valid GB18030-family Chinese text
- **THEN** the runtime MUST decode that file as GB18030-family text
- **AND** the runtime MUST persist the normalized content as UTF-8 text in the scoped workspace upload path

#### Scenario: Download returns normalized UTF-8 content
- **WHEN** a user downloads a previously uploaded supported text file that was normalized during upload
- **THEN** the runtime MUST return the UTF-8-normalized file bytes from workspace storage
- **AND** the runtime MUST NOT attempt to reconstruct or return the original pre-normalization byte encoding

### Requirement: Unsupported upload encodings SHALL fail explicitly
The runtime SHALL reject supported file uploads whose content cannot be reliably decoded as supported text encodings instead of persisting unreadable bytes that later open as mojibake.

#### Scenario: Unsupported text encoding upload is rejected
- **WHEN** a user uploads a supported file extension whose content is neither valid UTF-8, nor BOM-identified Unicode text, nor decodable supported GB18030-family text
- **THEN** the runtime MUST reject the upload with an explicit error response
- **AND** the runtime MUST NOT create or overwrite the scoped workspace upload entry for that file

#### Scenario: Non-text content disguised as a supported extension is rejected
- **WHEN** a user uploads binary or otherwise invalid non-text bytes using a supported text file extension
- **THEN** the runtime MUST fail the upload instead of storing the bytes as a workspace text file
- **AND** the error response MUST make it clear that the upload content is unsupported or not valid text
