## MODIFIED Requirements

### Requirement: Governed skill scripts SHALL execute through fixed Node entrypoints without shell composition
The runtime SHALL execute approved skill scripts through a fixed Node runtime contract that does not allow the model to compose arbitrary shell commands.

#### Scenario: Runtime owns the executable command and process settings
- **WHEN** an approved script template is invoked
- **THEN** the runtime MUST choose the Node executable, resolved script entry, working directory, timeout, and environment for that invocation
- **AND** the `--import` loader argument MUST be a `file://` URL generated via `pathToFileURL()` to ensure compatibility across all platforms (macOS, Linux, Windows) and Node.js versions (v22+, v24+)
- **AND** the invocation contract MUST NOT allow the caller to override those process settings with arbitrary `command`, `cwd`, `env`, or shell text

#### Scenario: Non-Node-executable script entries are not invoked
- **WHEN** a script manifest entry does not resolve to a Node-executable runtime asset in the current source or dist layout
- **THEN** the runtime MUST reject that script entry for invocation
- **AND** it MUST surface that failure explicitly rather than silently falling back to a shell-based launcher
