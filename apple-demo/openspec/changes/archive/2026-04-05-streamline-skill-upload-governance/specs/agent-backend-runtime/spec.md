## ADDED Requirements

### Requirement: Runtime skill catalog SHALL support in-process canonical reload
The runtime SHALL rebuild canonical skill discovery and governed skill projections after successful admin upload, overwrite, or delete operations without requiring an `agent-backend` process restart.

#### Scenario: Upload reload makes the new canonical skill immediately discoverable
- **WHEN** an administrator successfully uploads a valid canonical skill package
- **THEN** the runtime MUST reload the canonical skill catalog before the admin API reports success
- **AND** subsequent governed admin or runtime metadata requests MUST observe the uploaded skill without restarting the backend service

#### Scenario: Delete reload removes the canonical skill from governed runtime surfaces
- **WHEN** an administrator successfully deletes a managed skill and its canonical package
- **THEN** the runtime MUST reload the canonical skill catalog before the admin API reports success
- **AND** subsequent governed runtime discovery and execution paths MUST treat that skill as unavailable without restarting the backend service

## MODIFIED Requirements

### Requirement: Skill and agent assets remain executable in source and dist modes
The migrated runtime SHALL package agent definitions, shared canonical skill packages, governed script manifests, Node-executable skill script entries, and related references so that runtime execution can resolve the intended canonical skill assets in both source and dist modes while exposing only the governed skill surface to agents and end users.

#### Scenario: Governed runtime surface resolves shared canonical skill assets and script manifests
- **WHEN** the runtime builds the available skill set for an agent
- **THEN** it MUST resolve execution against canonical skill assets packaged under `apps/agent-backend/assets/skills/**`
- **AND** it MUST continue to resolve agent definitions from `apps/agent-backend/assets/agents/**`
- **AND** it MUST include only skills that are approved through the managed skill governance layer for that agent surface
- **AND** any executable automation for those skills MUST be derived from canonical governed script manifests rather than from free-form shell text in `SKILL.md`

#### Scenario: Skill tool denies unmanaged or unapproved skills
- **WHEN** an execution requests a skill that exists in canonical assets but is not approved in the governed surface for the current request
- **THEN** the runtime MUST deny the skill-tool load for that skill
- **AND** the runtime MUST avoid exposing the raw skill body through the governed execution path

#### Scenario: Dist build preserves governed skill execution
- **WHEN** the dist package is assembled and later executes an approved governed skill
- **THEN** any runtime-sensitive canonical skill references, governed script manifests, and Node-executable script entries MUST still resolve to the dist layout expected by the released package
- **AND** governed skill approval MUST continue to apply in dist mode
