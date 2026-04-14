## MODIFIED Requirements

### Requirement: Skill and agent assets remain executable in source and dist modes
The migrated runtime SHALL package agent definitions, skill definitions, skill scripts, and related references so that runtime execution can resolve the intended canonical skill assets in both source and dist modes while exposing only the governed skill surface to agents and end users.

#### Scenario: Governed runtime surface resolves canonical skill assets
- **WHEN** the runtime builds the available skill set for an agent
- **THEN** it MUST resolve execution against canonical skill assets packaged under `apps/agent-backend/assets/**`
- **AND** it MUST include only skills that are approved through the managed skill governance layer for that agent surface

#### Scenario: Skill tool denies unmanaged or unapproved skills
- **WHEN** an execution requests a skill that exists in canonical assets but is not approved in the governed surface for the current request
- **THEN** the runtime MUST deny the skill-tool load for that skill
- **AND** the runtime MUST avoid exposing the raw skill body through the governed execution path

#### Scenario: Dist build preserves governed skill execution
- **WHEN** the dist package is assembled and later executes an approved governed skill
- **THEN** any runtime-sensitive canonical skill references MUST still resolve to the dist layout expected by the released package
- **AND** governed skill approval MUST continue to apply in dist mode

## ADDED Requirements

### Requirement: Runtime metadata SHALL expose governed skill surfaces
The runtime SHALL expose governed skill metadata to agent detail, bootstrap, and execution-planning surfaces so that runtime behavior matches managed skill policy.

#### Scenario: Agent detail returns only governed visible skills
- **WHEN** the frontend or another client requests agent detail for a governed agent surface
- **THEN** the runtime MUST return only managed skills that are visible for that surface
- **AND** each returned skill MUST contain governed display metadata rather than raw skill body content

#### Scenario: Planner candidate skills follow governed approval
- **WHEN** the runtime selects candidate skills for planning or build execution
- **THEN** it MUST choose candidates from the governed visible skill set for the current request
- **AND** experimental or unbound skills MUST NOT appear as planner candidates for production users
