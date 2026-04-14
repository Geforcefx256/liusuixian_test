## MODIFIED Requirements

### Requirement: Runtime tool deny policy SHALL coexist with governed runtime surfaces
The system SHALL support a runtime tool deny list in addition to the governed skill and agent surfaces already enforced by the current repository.

#### Scenario: Denied runtime tools are excluded without removing governed skill metadata
- **WHEN** the runtime catalog is built with configured denied tools
- **THEN** denied tools MUST be excluded from tool catalog and invocation
- **AND** governed agent metadata and governed skill metadata MUST continue to be resolved through the current managed skill governance path

#### Scenario: Governed skill approval remains authoritative when deny list is empty
- **WHEN** no runtime tool deny entries are configured
- **THEN** the runtime MUST continue to enforce governed skill visibility and approval exactly through the managed skill governance layer
- **AND** the absence of denied tools MUST NOT broaden the governed skill surface beyond what the managed registry allows

#### Scenario: Disabled local filesystem search stays hidden through runtime deny policy
- **WHEN** the shipped runtime configuration places `local:search_in_files` in the runtime tool deny list
- **THEN** the runtime MUST exclude that local tool from catalog and invocation
- **AND** the local tool provider implementation MAY remain packaged for future re-enablement through configuration changes

#### Scenario: Shipped defaults disable local bash execution until explicitly re-enabled
- **WHEN** the shipped runtime configuration places `local:bash` in the runtime tool deny list
- **THEN** the runtime MUST exclude `local:bash` from runtime bootstrap, runtime catalog, and invocation
- **AND** operators MAY re-enable `local:bash` only through an explicit configuration change that removes that deny entry

#### Scenario: Deleted gateway and MCP transform tools do not reappear through shipped defaults
- **WHEN** the shipped gateway and MCP configuration files omit `transform_rows` from their enabled server tool lists
- **THEN** `gateway:local:transform_rows` and `mcp:default:transform_rows` MUST NOT appear in runtime bootstrap or runtime catalog payloads
- **AND** the runtime MUST NOT rely on default fallback configuration that would silently restore those deleted tools
