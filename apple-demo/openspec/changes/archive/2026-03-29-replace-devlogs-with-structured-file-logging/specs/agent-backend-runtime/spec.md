## ADDED Requirements

### Requirement: Runtime logging SHALL persist structured backend-only category files
The runtime SHALL persist operational logs through an explicit backend logger that records stable `category` and `component` fields at write time and writes redacted JSONL entries into category-specific daily files for shell-based inspection.

#### Scenario: Enabled runtime file logging writes entries into category-specific daily files
- **WHEN** runtime file logging is enabled and a module emits a persisted log entry
- **THEN** the runtime MUST append that entry to a JSONL file under `apps/agent-backend/data/logs/<YYYY-MM-DD>/<category>.jsonl`
- **AND** each persisted entry MUST include at least timestamp, level, category, component, message, and any scoped runtime identifiers needed for debugging

#### Scenario: Persisted runtime logs do not rely on console interception
- **WHEN** a runtime module needs a persisted operational log entry
- **THEN** the runtime MUST record that entry through the structured logger contract rather than through intercepted `console.*` output
- **AND** persisted file logging MUST remain functional without a console bridge

### Requirement: Structured logging migration SHALL keep config changes logging-only
The structured logging migration SHALL limit `apps/agent-backend/config.json` changes to logging-related settings so unrelated runtime behavior does not change as part of the logging rollout.

#### Scenario: Logging migration does not alter unrelated runtime configuration
- **WHEN** operators adopt config updates required by the structured logging migration
- **THEN** those updates MUST be limited to logging-related fields such as `runtime.providerLogging`, `runtime.fileLogging`, or documented logging-specific successors
- **AND** auth, model, tool, sandbox, workspace, and other unrelated configuration semantics MUST remain unchanged by this change

## MODIFIED Requirements

### Requirement: Runtime behavior parity in the new package
The migrated package SHALL preserve the existing agent-backend product behavior, including authenticated agent execution, session persistence, planner/build phase handling, tool provider dispatch, structured runtime logging, memory management, and gateway/MCP integration.

#### Scenario: Core runtime routes remain available
- **WHEN** the migrated backend starts successfully
- **THEN** it MUST expose the same agent runtime route families for agents, runtime bootstrap, agent execution, files, memory, and gateway tools

#### Scenario: Planner and build phases remain enforceable
- **WHEN** a workspace-agent session enters planning and then transitions to build
- **THEN** the migrated runtime MUST preserve plan persistence, approval state, and approved-skill enforcement before build execution proceeds
