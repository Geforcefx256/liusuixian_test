## MODIFIED Requirements

### Requirement: Runtime SHALL provide an internal MML schema contract for table-view editing
The runtime SHALL preserve `/agent/api/files/mml-schema` as a frontend-compatible internal MML schema contract keyed by `networkType` and `networkVersion`, while sourcing the canonical schema from `web-backend` instead of owning a local MML rule catalog.

#### Scenario: Schema lookup returns command metadata for supported network context
- **WHEN** a client requests MML schema for a supported `networkType` and `networkVersion`
- **THEN** the runtime MUST fetch that schema from the canonical `web-backend` route
- **AND** it MUST return command-level and parameter-level metadata needed for MML table projection through the existing `/agent/api/files/mml-schema` response contract

#### Scenario: Unsupported network context returns no schema without breaking the workspace flow
- **WHEN** a client requests MML schema for a `networkType` and `networkVersion` pair that has no active canonical ruleset
- **THEN** the runtime MUST return an unavailable or empty schema result rather than fabricated command metadata
- **AND** the response MUST still allow the frontend to degrade the table view safely to read-only

#### Scenario: Conditional requiredness remains distinguishable from unconditional requiredness
- **WHEN** the runtime relays schema metadata for a parameter whose canonical workbook rule marks it as conditionally required
- **THEN** the returned parameter contract MUST preserve that parameter as conditionally required through `requiredMode` and condition metadata
- **AND** the runtime MUST NOT collapse that parameter into unconditional `required` semantics while proxying the canonical schema

### Requirement: Runtime SHALL proxy browser-authenticated MML schema lookup to web-backend
The runtime SHALL keep browser access on `/agent/api/files/mml-schema`, but it SHALL act only as a compatibility proxy and SHALL forward the authenticated browser session context to `web-backend` for canonical schema evaluation.

#### Scenario: Compatibility proxy forwards browser session context
- **WHEN** an authenticated browser request reaches `/agent/api/files/mml-schema`
- **THEN** the runtime MUST forward the relevant browser auth context needed by `web-backend` to evaluate the request
- **AND** the runtime MUST NOT require a separate new service token solely for MML schema proxying

#### Scenario: Compatibility proxy does not require local rule bootstrap
- **WHEN** `agent-backend` starts after this ownership migration
- **THEN** the runtime MUST NOT bootstrap or own a local Excel-backed MML rule database for schema lookup
- **AND** successful schema responses MUST remain available through the proxy as long as the canonical `web-backend` rule catalog is available
