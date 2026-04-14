## MODIFIED Requirements

### Requirement: Runtime metadata SHALL expose governed skill surfaces
The runtime SHALL expose governed skill metadata to agent detail, bootstrap, and execution-planning surfaces so that runtime behavior matches managed skill policy for the current agent binding and lifecycle state.

#### Scenario: Agent detail returns only published bound skills
- **WHEN** the frontend or another client requests agent detail for a governed agent surface
- **THEN** the runtime MUST return only managed skills that are `published` and bound for that surface
- **AND** each returned skill MUST contain the governed user-visible name resolved for that agent surface rather than raw canonical skill identity

#### Scenario: Planner candidate skills follow published approval
- **WHEN** the runtime selects candidate skills for planning or build execution
- **THEN** it MUST choose candidates from the governed visible skill set that is both `published` and bound for the current request
- **AND** draft or unbound skills MUST NOT appear as planner candidates for governed runtime users

#### Scenario: Upload or overwrite reset hides skill until publication
- **WHEN** a canonical skill package is uploaded or overwritten and the managed skill resets to `draft`
- **THEN** subsequent bootstrap, governed discovery, and execution authorization paths MUST treat that skill as unavailable
- **AND** the runtime MUST keep that skill out of governed runtime surfaces until the administrator explicitly republishes it
