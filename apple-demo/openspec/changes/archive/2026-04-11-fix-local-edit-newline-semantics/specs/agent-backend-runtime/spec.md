## ADDED Requirements

### Requirement: Local file editing SHALL match the normalized read_file text view
The agent backend SHALL ensure that `local:edit` matches `old_string` against the same newline-normalized text view exposed by `read_file`, so content copied from `read_file` remains editable across supported text line endings.

#### Scenario: Multi-line old_string from read_file matches a CRLF file
- **WHEN** `read_file` returns content for a text file stored with `\r\n` line endings
- **AND** the caller copies a multi-line `old_string` from that returned content without line-number prefixes
- **THEN** `local:edit` MUST evaluate that `old_string` against the same normalized text view used by `read_file`
- **AND** the replacement MUST succeed when the normalized content identifies a unique match

#### Scenario: LF files keep the existing exact-match behavior
- **WHEN** `read_file` returns content for a text file already stored with `\n` line endings
- **THEN** `local:edit` MUST preserve the existing exact string replacement behavior for the copied `old_string`
- **AND** successful edits MUST continue to report the correct replacement count

### Requirement: Local file editing SHALL preserve the file's dominant line ending style on write
After applying a replacement in the normalized edit view, the agent backend SHALL write the file back using the target file's dominant existing line ending style.

#### Scenario: Editing a CRLF file preserves CRLF on disk
- **WHEN** `local:edit` successfully updates a text file whose dominant existing line ending style is `\r\n`
- **THEN** the written file MUST keep `\r\n` line endings for the updated content
- **AND** the edit MUST NOT rewrite the entire file to `\n` line endings solely because the match was evaluated in a normalized view

#### Scenario: Replacement text containing normalized newlines is restored to the file style
- **WHEN** `local:edit` applies a `new_string` that contains `\n` in the normalized edit view
- **THEN** the persisted file MUST restore those newlines to the target file's dominant line ending style before writing
