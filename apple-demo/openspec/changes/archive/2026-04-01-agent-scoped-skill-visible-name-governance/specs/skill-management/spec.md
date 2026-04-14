## MODIFIED Requirements

### Requirement: Managed skills SHALL control production versus experimental surface policy
The system SHALL let administrators decide whether a managed skill is production-visible or experimental without removing the canonical skill package from the system, but a managed skill MUST remain experimental whenever any bound agent has not completed user-visible name governance.

#### Scenario: Experimental skill is withheld from production surface
- **WHEN** a managed skill is marked experimental
- **THEN** the system MUST keep the skill out of production user-facing discovery surfaces
- **AND** the system MUST prevent production runtime surfaces from treating that skill as available by default

#### Scenario: Production skill is promoted without reauthoring the package
- **WHEN** an administrator promotes a managed skill from experimental to production
- **THEN** the system MUST expose the same canonical skill package through production surfaces
- **AND** the promotion MUST NOT require editing the underlying `SKILL.md`

#### Scenario: Incomplete agent-scoped governance blocks production promotion
- **WHEN** an administrator attempts to save a managed skill in `生产` while any bound agent has an empty user-visible name or a default imported name equal to the canonical skill identity
- **THEN** the system MUST reject that promotion as incomplete governance
- **AND** the managed skill MUST remain in `测试`

### Requirement: Managed skills SHALL define agent binding and governed display metadata
The system SHALL allow administrators to bind managed skills to specific agents and define agent-scoped governed user-facing names, governed descriptions, and display-surface metadata used in managed product surfaces.

#### Scenario: Managed skill is bound to one agent but not another
- **WHEN** an administrator binds a managed skill to a selected agent set
- **THEN** only those bound agents MUST receive the skill in their governed runtime surface
- **AND** unbound agents MUST NOT expose the skill in governed metadata or execution paths

#### Scenario: Same canonical skill uses different governed names on different agents
- **WHEN** an administrator configures user-visible names for the same canonical skill on two different bound agents
- **THEN** the system MUST persist those names independently per agent binding
- **AND** each agent surface MUST resolve the governed skill name from its own binding entry rather than from a single global display name

#### Scenario: Governed user-visible names are unique within an agent
- **WHEN** an administrator saves a user-visible skill name for a bound agent
- **THEN** the system MUST validate that no other managed skill bound to that same agent already uses the same user-visible name
- **AND** the system MUST reject the save if that agent-scoped name is not unique

#### Scenario: User-facing discovery shows current agent governed description only
- **WHEN** a governed product surface lists a managed skill for an end user on a specific agent
- **THEN** the system MUST show that agent binding's governed user-visible name together with the governed description for that skill
- **AND** the system MUST NOT expose the raw `SKILL.md` body or internal execution instructions to that end user

#### Scenario: Administrator edits governed surface labels with product terminology
- **WHEN** an administrator views or edits display-surface metadata for a managed skill in the management UI
- **THEN** the UI MUST present per-agent user-visible name controls using the user-facing label `用户可见名称`
- **AND** the selectable governed surface labels MUST be `生产` and `测试`
- **AND** persisting those labels MUST continue to map to the existing managed surface policy without changing canonical skill package contents
