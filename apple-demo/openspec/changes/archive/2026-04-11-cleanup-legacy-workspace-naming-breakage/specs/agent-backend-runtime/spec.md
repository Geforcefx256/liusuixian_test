## ADDED Requirements

### Requirement: Runtime upgrade SHALL require explicit cleanup of legacy workspace naming data
The runtime SHALL reject startup when persisted workspace state still uses the retired `input`, `working`, `output`, `uploads/`, or `outputs/` naming, and SHALL rely on an explicit cleanup operation rather than runtime compatibility.

#### Scenario: Startup rejects legacy workspace roots
- **WHEN** backend initialization detects a scoped workspace that still contains legacy `uploads/` or `outputs/` directories
- **THEN** the runtime MUST fail startup explicitly
- **AND** the failure MUST instruct operators to run the dedicated legacy workspace cleanup command before restarting

#### Scenario: Startup rejects legacy persisted session workspace metadata
- **WHEN** backend initialization detects persisted session metadata that still contains workspace entries using legacy `groupId` or `source` values such as `input`, `working`, or `output`
- **THEN** the runtime MUST fail startup explicitly
- **AND** it MUST NOT silently drop or reinterpret those legacy workspace entries during normal startup

#### Scenario: Explicit cleanup removes legacy workspace naming state
- **WHEN** an operator runs the repository-owned cleanup command before upgrade
- **THEN** that cleanup MUST remove legacy workspace roots and persisted legacy workspace file metadata that use retired naming
- **AND** the next backend startup MUST proceed only if no legacy workspace naming artifacts remain
