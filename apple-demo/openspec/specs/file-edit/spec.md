# file-edit Specification

## Purpose
TBD - created by archiving change add-local-edit-tool. Update Purpose after archive.
## Requirements
### Requirement: Edit tool performs exact string replacement in output files
The `local:edit` tool SHALL accept `file_path`, `old_string`, `new_string`, and optional `replace_all` parameters, and perform exact string replacement on the target file.

#### Scenario: Single occurrence replacement
- **WHEN** LLM calls `edit` with `file_path` pointing to an existing output file, `old_string` that appears exactly once in the file, and `new_string`
- **THEN** the tool SHALL replace that single occurrence and return `{ success: true, type: "file_edit", path: "<relative_path>", replacements: 1 }`

#### Scenario: Replace all occurrences
- **WHEN** LLM calls `edit` with `replace_all: true` and `old_string` appears N times in the file
- **THEN** the tool SHALL replace all N occurrences and return `{ ..., replacements: N }`

#### Scenario: Deletion via empty new_string
- **WHEN** LLM calls `edit` with `new_string` set to empty string `""`
- **THEN** the tool SHALL remove the matched `old_string` from the file content

### Requirement: Edit tool restricts edits to outputs directory only
The `local:edit` tool SHALL only allow editing files within the workspace `outputs/` directory. Files outside this boundary (including `uploads/`, `plans/`, `temp/`) MUST be rejected.

#### Scenario: Valid output file path
- **WHEN** LLM calls `edit` with `file_path` pointing to a file under `outputs/`
- **THEN** the tool SHALL proceed with the edit operation

#### Scenario: Path traversal attempt
- **WHEN** LLM calls `edit` with `file_path` containing `../` to escape the outputs directory
- **THEN** the tool SHALL reject with an error message indicating the path escapes the scoped outputs directory

#### Scenario: Absolute path rejected
- **WHEN** LLM calls `edit` with an absolute `file_path` (e.g., `/etc/passwd`)
- **THEN** the tool SHALL reject with an error message indicating the path must be relative

### Requirement: Edit tool validates old_string uniqueness
When `replace_all` is `false` (default), the tool MUST verify that `old_string` matches exactly once in the file. Multiple matches SHALL be rejected to prevent unintended modifications.

#### Scenario: Unique match succeeds
- **WHEN** `old_string` appears exactly once in the file and `replace_all` is `false`
- **THEN** the tool SHALL perform the replacement

#### Scenario: Multiple matches without replace_all
- **WHEN** `old_string` appears more than once in the file and `replace_all` is `false` or omitted
- **THEN** the tool SHALL reject with an error message indicating the count of occurrences and suggesting to use `replace_all: true` or provide a more specific `old_string`

#### Scenario: old_string not found
- **WHEN** `old_string` does not exist in the file content
- **THEN** the tool SHALL reject with an error message indicating the string was not found and suggesting to use `read_file` to verify current content

### Requirement: Edit tool performs staleness check
The tool SHALL detect when a file has been modified externally since the last `read_file` call, and reject edits on stale content.

#### Scenario: File unmodified since read
- **WHEN** LLM has previously called `read_file` on the target file, and the file has not been modified since
- **THEN** the tool SHALL proceed with the edit

#### Scenario: File modified since read
- **WHEN** LLM has previously called `read_file` on the target file, but the file's mtime has changed since that read
- **THEN** the tool SHALL reject with an error message instructing to read the file again

#### Scenario: File never read in session
- **WHEN** no `read_file` call has been recorded for the target file in the current session, and no `sessionKey` is available
- **THEN** the tool SHALL proceed without staleness check (graceful degradation)

#### Scenario: Consecutive edits without re-reading
- **WHEN** LLM successfully edits a file, then calls `edit` again on the same file without calling `read_file` in between
- **THEN** the tool SHALL proceed because the edit tool updates the staleness record after each successful write

### Requirement: read_file records file metadata for staleness tracking
The `read_file` tool SHALL record `{ absolutePath, relativePath, mtimeMs }` after each successful read, scoped by session key. This state is used by the `edit` tool for staleness detection.

#### Scenario: read_file records mtime
- **WHEN** LLM calls `read_file` with a valid session context
- **THEN** the tool SHALL record the file's `mtimeMs` in the session-scoped `ReadFileStateMap`

#### Scenario: Subsequent read updates record
- **WHEN** LLM calls `read_file` on a file that was previously read in the same session
- **THEN** the tool SHALL overwrite the previous record with the latest `mtimeMs`

