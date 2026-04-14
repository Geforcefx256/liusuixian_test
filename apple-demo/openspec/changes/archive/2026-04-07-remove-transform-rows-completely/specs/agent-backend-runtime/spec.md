## MODIFIED Requirements

### Requirement: Runtime tool deny policy SHALL coexist with governed runtime surfaces
The system SHALL support a runtime tool deny list in addition to the governed skill and agent surfaces already enforced by the current repository, but shipped deletion of a runtime tool MUST be expressed by removing that tool from shipped configuration and runtime fallback semantics rather than by keeping a deny-only tombstone.

#### Scenario: Denied runtime tools are excluded without removing governed skill metadata
- **WHEN** the runtime catalog is built with configured denied tools
- **THEN** denied tools MUST be excluded from tool catalog and invocation
- **AND** governed agent metadata and governed skill metadata MUST continue to be resolved through the current managed skill governance path

#### Scenario: Governed skill approval remains authoritative when deny list is empty
- **WHEN** no runtime tool deny entries are configured
- **THEN** the runtime MUST continue to enforce governed skill visibility and approval exactly through the managed skill governance layer
- **AND** the absence of denied tools MUST NOT broaden the governed skill surface beyond what the managed registry allows

#### Scenario: Configured local grep deny stays authoritative
- **WHEN** runtime configuration places `local:grep` in the runtime tool deny list
- **THEN** the runtime MUST exclude that local tool from catalog and invocation
- **AND** the local tool provider implementation MAY remain packaged for future re-enablement through configuration changes

#### Scenario: Deleted transform_rows does not survive through deny-only semantics
- **WHEN** the shipped runtime no longer supports `transform_rows` on gateway or MCP paths
- **THEN** shipped configuration MUST remove `transform_rows` from gateway/MCP default configuration and enabled tool lists
- **AND** shipped runtime deny configuration MUST NOT retain `gateway:*:transform_rows` or `mcp:*:transform_rows` entries as the primary deletion mechanism
- **AND** the runtime MUST NOT rely on deny-only masking to represent that deleted tool as removed

## ADDED Requirements

### Requirement: Runtime SHALL require explicit surviving gateway and MCP tool identifiers
The runtime SHALL require explicit tool identifiers for gateway and MCP invocation paths once deleted legacy default-tool semantics are removed.

#### Scenario: MCP invocation without tool fails explicitly
- **WHEN** an MCP invocation request reaches execution without an explicit `tool` value
- **THEN** the runtime MUST fail that invocation explicitly
- **AND** it MUST NOT fall back to a deleted or implicit default tool name

#### Scenario: Gateway and MCP configuration parsing does not restore transform_rows through defaults
- **WHEN** gateway or MCP configuration omits tool lists, omits legacy default-tool fields, or loads shipped config files with empty tool arrays
- **THEN** the parsed runtime configuration MUST NOT synthesize `transform_rows` as a fallback tool
- **AND** runtime bootstrap and tool catalog payloads MUST NOT expose `transform_rows` through parsed defaults

#### Scenario: Repository test and sample surfaces stop treating transform_rows as canonical
- **WHEN** backend tests or sample runtime configuration exercise gateway/MCP tool parsing or invocation
- **THEN** those tests and samples MUST use surviving neutral tool identifiers instead of `transform_rows`
- **AND** the repository MUST NOT use `transform_rows` as the canonical example of a supported runtime tool
