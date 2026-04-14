## MODIFIED Requirements

### Requirement: Runtime metadata SHALL expose governed skill surfaces
The runtime SHALL expose governed skill metadata to agent detail, bootstrap, and execution-planning surfaces so that runtime behavior matches managed skill policy for the current agent binding and lifecycle state, and SHALL include the metadata foundation's canonical passthrough fields in those surfaces without changing runtime behavior.

#### Scenario: Agent detail returns only published bound skills with governed identity and canonical passthrough metadata
- **WHEN** the frontend or another client requests agent detail for a governed agent surface
- **THEN** the runtime MUST return only managed skills that are `published` and bound for that surface
- **AND** each returned skill MUST contain the governed user-visible name resolved for that agent surface rather than raw canonical skill identity
- **AND** each returned skill MUST include any available canonical passthrough metadata mirrored from the canonical `SKILL.md`

#### Scenario: Planner candidate skills follow published approval
- **WHEN** the runtime selects candidate skills for planning or build execution
- **THEN** it MUST choose candidates from the governed visible skill set that is both `published` and bound for the current request
- **AND** draft or unbound skills MUST NOT appear as planner candidates for governed runtime users

#### Scenario: Upload or overwrite reset hides skill until publication
- **WHEN** a canonical skill package is uploaded or overwritten and the managed skill resets to `draft`
- **THEN** subsequent bootstrap, governed discovery, and execution authorization paths MUST treat that skill as unavailable
- **AND** the runtime MUST keep that skill out of governed runtime surfaces until the administrator explicitly republishes it

#### Scenario: Execution catalog includes canonical passthrough metadata without policy activation
- **WHEN** the runtime builds an execution catalog or agent definition for a governed skill surface
- **THEN** it MUST include the canonical metadata fields mirrored by the metadata foundation when those fields are present
- **AND** it MUST preserve omitted optional metadata as absent in the execution surface
- **AND** it MUST NOT treat the presence of `allowed-tools`, `user-invocable`, `disable-model-invocation`, `model`, `effort`, or `context` as a behavior change in this change
