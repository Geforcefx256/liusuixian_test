## ADDED Requirements

### Requirement: Runtime model selection MUST align with the source repository provider registry semantics
The system SHALL resolve active runtime models using the same semantic rules as the source repository, including normalization of legacy global active-model configuration into the current runtime selection contract.

#### Scenario: Legacy active model name resolves to the configured source-baseline model
- **WHEN** configuration provides a legacy global active-model reference that points to an entry in the model registry
- **THEN** the runtime MUST resolve that reference to the corresponding model configuration
- **AND** the resolved runtime metadata MUST expose that model as the active global model source

#### Scenario: Agent-specific model binding overrides the global active model
- **WHEN** a specific agent has its own model binding and a separate global active model also exists
- **THEN** the runtime MUST use the agent-specific binding for that agent
- **AND** the global active model MUST remain the fallback for agents without an explicit binding

### Requirement: Runtime MUST fully support the source-baseline huaweiHisApi provider contract
The system SHALL preserve the source repository's `huaweiHisApi` provider contract across configuration, runtime request construction, and runtime metadata exposure.

#### Scenario: Huawei HIS API model entry preserves custom headers and custom body
- **WHEN** the configured active model is a `huaweiHisApi` registry entry with custom headers and custom request body fields
- **THEN** the runtime MUST send those configured headers and body fields with the provider request
- **AND** the runtime MUST avoid replacing them with an unrelated provider alias during execution

#### Scenario: Runtime metadata exposes the configured huaweiHisApi provider identity
- **WHEN** a client requests runtime bootstrap or runtime model metadata while `huaweiHisApi` is active
- **THEN** the runtime MUST report `huaweiHisApi` as the configured provider identity
- **AND** the metadata MUST remain consistent with the resolved active model entry

### Requirement: Auth-integrated runtime origin policy MUST match the source SSO baseline
The system SHALL apply the source repository's wildcard-capable same-origin allowlist behavior to the agent-backend routes that rely on authenticated browser session context.

#### Scenario: Agent backend accepts configured wildcard development origins
- **WHEN** the agent-backend same-origin policy is configured with the same wildcard origin pattern used by the source repository baseline
- **THEN** matching authenticated browser requests to state-changing agent routes MUST be accepted
- **AND** the runtime MUST keep the authenticated request flow intact

#### Scenario: Agent backend still rejects unmatched origins
- **WHEN** an authenticated browser request targets a protected state-changing agent route from an origin outside the configured wildcard or exact allowlist
- **THEN** the runtime MUST reject the request explicitly
- **AND** the route MUST NOT continue into agent execution

### Requirement: Shared runtime dependencies MUST align with the source repository baseline for overlapping packages
The system SHALL use the source repository's declared versions as the dependency baseline for overlapping third-party packages used by `apps/web`, `apps/web-backend`, and `apps/agent-backend`.

#### Scenario: Overlapping package versions follow the source baseline
- **WHEN** a third-party package is used in both the current repository and the source repository
- **THEN** the current repository MUST adopt the source repository's declared version for that overlapping package
- **AND** the affected package manifests and lockfiles MUST reflect that baseline after alignment

#### Scenario: Dependency alignment does not require monorepo structure rollback
- **WHEN** overlapping package versions are aligned to the source baseline
- **THEN** the current repository MUST keep its existing `apps/*` package structure
- **AND** dependency alignment MUST NOT require restoring the source repository's full monorepo layout
