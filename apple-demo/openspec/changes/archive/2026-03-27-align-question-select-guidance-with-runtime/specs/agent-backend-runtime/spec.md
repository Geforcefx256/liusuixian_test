## ADDED Requirements

### Requirement: Runtime question guidance SHALL stay aligned with the enforced select-option contract
The runtime SHALL expose model-facing question-tool guidance that matches the currently enforced `local:question` contract for closed-choice `select` inputs.

#### Scenario: Agent context guidance does not advertise a 4-option ceiling
- **WHEN** runtime agent context or equivalent model-facing guidance describes how to construct `local:question` `select` inputs
- **THEN** that guidance MUST describe `select` as valid for closed-choice inputs with at least 2 options
- **AND** that guidance MUST NOT state or imply that `select` is limited to 4 options

#### Scenario: Guidance still distinguishes closed-choice select from open-ended text
- **WHEN** runtime guidance explains when to use `select` versus `text` in `local:question`
- **THEN** it MUST preserve the rule that open-ended values use `text`
- **AND** it MUST preserve that `select` is reserved for closed-choice answers rather than free-form input

#### Scenario: Verification covers model-facing guidance surfaces
- **WHEN** automated verification checks question-tool guidance in runtime prompts or agent context assets
- **THEN** those checks MUST assert the minimum-only `select` contract instead of the obsolete `2-4` wording
- **AND** the checks MUST fail explicitly if model-facing guidance drifts away from the enforced runtime behavior
