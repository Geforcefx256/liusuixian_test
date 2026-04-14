## ADDED Requirements

### Requirement: Governed skill approval SHALL apply to skill asset access
The system SHALL apply managed skill approval, surface visibility, and agent binding rules to governed skill asset tools in the same way it applies them to `skill:skill`.

#### Scenario: Approved bound skill may expose its own assets
- **WHEN** a governed runtime surface resolves a canonical skill that is approved and bound to the current agent
- **THEN** the runtime MAY allow that skill to be addressed by governed skill asset tools
- **AND** the authorized asset scope MUST remain limited to that canonical skill package

#### Scenario: Hidden or unbound skill assets remain inaccessible
- **WHEN** a request asks a governed skill asset tool to access a canonical skill that is hidden, disabled, experimental for that surface, or unbound from the current agent
- **THEN** the runtime MUST reject that request as unapproved skill access
- **AND** it MUST NOT expose asset names, directory listings, or file contents for that skill

#### Scenario: Approval of one skill does not authorize sibling skill packages
- **WHEN** a request accesses assets for one approved canonical skill
- **THEN** the runtime MUST evaluate authorization for the named skill only
- **AND** it MUST NOT treat that approval as permission to browse or read assets from any other skill package
