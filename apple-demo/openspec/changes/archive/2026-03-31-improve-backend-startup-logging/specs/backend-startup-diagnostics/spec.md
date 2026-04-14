## ADDED Requirements

### Requirement: Backend services SHALL emit a startup summary with effective access and config details
The system SHALL emit a startup summary when `apps/web-backend` or `apps/agent-backend` starts successfully. That summary MUST identify the service name, effective protocol, host, port, base URL, health-check endpoint, configuration source, and the key non-secret runtime paths or settings that are most relevant for diagnosing startup behavior.

#### Scenario: Web backend startup summary includes access and config details
- **WHEN** `apps/web-backend` completes startup successfully
- **THEN** the emitted startup log MUST include the effective base URL and `GET /health` endpoint
- **AND** it MUST identify whether the service is using defaults or `apps/web-backend/config.json`
- **AND** it MUST include the effective SQLite data path and MML rule source/database paths or equivalent startup-critical configuration fields

#### Scenario: Agent backend startup summary includes access and config details
- **WHEN** `apps/agent-backend` completes startup successfully
- **THEN** the emitted startup log MUST include the effective base URL and `GET /health` endpoint
- **AND** it MUST include the effective runtime workspace path, memory database path, and gateway or model configuration source fields already used for startup diagnostics
- **AND** it MUST avoid printing secrets while still indicating whether critical credentials or optional features are configured

### Requirement: Backend services SHALL surface startup warnings and process-level diagnostics
The system SHALL surface startup warnings and process-level diagnostics in a stable, human-readable form so that developers can distinguish non-fatal warnings from fatal startup failures without re-reading source code.

#### Scenario: Process warning is surfaced with context
- **WHEN** either backend process receives a Node `warning` event during startup or runtime
- **THEN** the service MUST print a warning diagnostic that identifies the service, warning name, warning message, and any available stack or detail context

#### Scenario: Startup bootstrap warning remains visible
- **WHEN** a backend startup step encounters a non-fatal warning condition such as a missing optional source directory or a degraded optional feature
- **THEN** the warning MUST remain visible in startup diagnostics
- **AND** the service MUST continue startup only when the existing service behavior already allows that condition to be non-fatal

### Requirement: Backend services SHALL print actionable fatal error diagnostics at startup
The system SHALL print actionable fatal diagnostics when startup fails or when the process encounters an unhandled fatal error. Those diagnostics MUST identify the service and preserve enough error context for a developer to see what failed and where.

#### Scenario: Startup failure prints service-scoped fatal diagnostics
- **WHEN** `apps/web-backend` or `apps/agent-backend` fails during startup
- **THEN** the emitted fatal log MUST identify the service and failure stage
- **AND** it MUST include the error message plus any available stack or nested cause summary

#### Scenario: Unhandled runtime fatal error is surfaced
- **WHEN** either backend process encounters an `uncaughtException` or `unhandledRejection`
- **THEN** the service MUST print a fatal diagnostic that identifies the service and preserves the error or rejection summary
- **AND** the output MUST happen before the process follows its existing exit or shutdown behavior
