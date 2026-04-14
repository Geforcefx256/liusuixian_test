## ADDED Requirements

### Requirement: Runtime SHALL expose workspace-scoped `local:grep` for executor agents
The runtime SHALL expose a `local:grep` tool for executor agents as the canonical local content-search capability and SHALL stop exposing `local:search_in_files` once this change is applied.

#### Scenario: Executor tool catalog exposes only `local:grep` for local content search
- **WHEN** the runtime builds the local tool catalog for an execution-capable agent surface
- **THEN** it MUST expose `local:grep` as the local content-search tool
- **AND** it MUST NOT expose `local:search_in_files` as a separate searchable local tool

#### Scenario: Planner surface does not gain `local:grep`
- **WHEN** the runtime builds the tool surface for planner-only execution contexts
- **THEN** it MUST NOT newly expose `local:grep` to that planner surface as part of this change

### Requirement: Runtime SHALL execute `local:grep` with vendored ripgrep assets
The runtime SHALL execute `local:grep` with a vendored `ripgrep 15.1.0` binary packaged under `apps/agent-backend/assets/vendor/ripgrep/` and SHALL select the binary by supported runtime target instead of depending on a host-installed `rg`.

#### Scenario: Linux runtime selects vendored ripgrep by platform, architecture, and libc
- **WHEN** `local:grep` executes on Linux
- **THEN** the runtime MUST resolve the vendored `rg` binary using `platform + arch + libc`
- **AND** it MUST select the matching target directory for the current runtime before invoking the search

#### Scenario: Windows runtime selects vendored ripgrep by platform and architecture
- **WHEN** `local:grep` executes on Windows
- **THEN** the runtime MUST resolve the vendored `rg.exe` binary using `platform + arch`
- **AND** it MUST invoke that vendored binary instead of a PATH-discovered `rg`

#### Scenario: macOS runtime selects vendored ripgrep by platform and architecture
- **WHEN** `local:grep` executes on macOS
- **THEN** the runtime MUST resolve the vendored `rg` binary using `platform + arch`
- **AND** it MUST invoke that vendored binary instead of a PATH-discovered `rg`

#### Scenario: Dist build preserves vendored ripgrep assets
- **WHEN** `apps/agent-backend` is assembled into dist output
- **THEN** the packaged assets MUST include the vendored `ripgrep` target directories required by this change
- **AND** `local:grep` in dist mode MUST resolve those packaged assets without reading from the source tree

### Requirement: Runtime SHALL keep `local:grep` scoped to the current workspace
The runtime SHALL limit `local:grep` to paths rooted in the current resolved workspace scope and SHALL reject paths that escape that workspace.

#### Scenario: Search path is rooted to workspace scope
- **WHEN** `local:grep` executes with no explicit base path
- **THEN** it MUST search from the current resolved workspace root
- **AND** it MUST treat the search as scoped to that workspace only

#### Scenario: Escaping the workspace is rejected
- **WHEN** `local:grep` receives a base path or derived path that resolves outside the current workspace root
- **THEN** the runtime MUST fail the tool invocation explicitly
- **AND** it MUST NOT run `rg` against that out-of-workspace path

### Requirement: Runtime SHALL surface explicit `local:grep` diagnostics
The runtime SHALL emit runtime logs that make vendored `ripgrep` selection and `local:grep` execution diagnosable, and SHALL distinguish successful no-match results from execution failures.

#### Scenario: Ripgrep selection is logged before or during first use
- **WHEN** the runtime selects the vendored binary for `local:grep`
- **THEN** it MUST log the resolved platform, architecture, libc classification when applicable, target triple, binary path, and `rg --version` result

#### Scenario: Successful no-match search is not reported as a failure
- **WHEN** `local:grep` completes successfully and `rg` returns no matches
- **THEN** the runtime MUST record that invocation as a successful no-match outcome
- **AND** it MUST NOT classify that result as a tool execution failure

#### Scenario: Ripgrep execution failure is reported with diagnostics
- **WHEN** vendored `rg` is missing, not executable, fails to start, times out, or exits with an unexpected non-zero code
- **THEN** the runtime MUST fail `local:grep` explicitly
- **AND** the runtime logs MUST include the resolved binary path, invocation context, exit code or signal when available, and stderr details when available
