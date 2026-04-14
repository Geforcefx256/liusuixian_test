## MODIFIED Requirements

### Requirement: Managed skills SHALL control production versus experimental surface policy
The system SHALL let administrators decide whether a managed skill is production-visible or experimental without removing the canonical skill package from the system, but a managed skill MUST remain experimental whenever its unified skill-level user-visible name governance is incomplete.

#### Scenario: Experimental skill is withheld from production surface
- **WHEN** a managed skill is marked experimental
- **THEN** the system MUST keep the skill out of production user-facing discovery surfaces
- **AND** the system MUST prevent production runtime surfaces from treating that skill as available by default

#### Scenario: Production skill is promoted without reauthoring the package
- **WHEN** an administrator promotes a managed skill from experimental to production
- **THEN** the system MUST expose the same canonical skill package through production surfaces
- **AND** the promotion MUST NOT require editing the underlying `SKILL.md`

#### Scenario: Incomplete unified name governance blocks production promotion
- **WHEN** an administrator attempts to save a managed skill in `生产` while the managed skill-level `用户可见名称` is empty or still equal to the default imported canonical identity
- **THEN** the system MUST reject that promotion as incomplete governance
- **AND** the managed skill MUST remain in `测试`

### Requirement: Managed skills SHALL define agent binding and governed display metadata
The system SHALL allow administrators to bind managed skills to specific agents while governing a single skill-level user-visible name, governed description, and display-surface metadata used in managed product surfaces.

#### Scenario: Managed skill is bound to one agent but not another
- **WHEN** an administrator binds a managed skill to a selected agent set
- **THEN** only those bound agents MUST receive the skill in their governed runtime surface
- **AND** unbound agents MUST NOT expose the skill in governed metadata or execution paths

#### Scenario: Unified governed name is shared by every bound agent
- **WHEN** an administrator saves a skill-level `用户可见名称` for a managed skill that is bound to multiple agents
- **THEN** the system MUST persist that user-visible name once at the managed skill level
- **AND** every bound agent surface MUST resolve the same governed skill name from that shared managed skill metadata rather than from an agent-specific override

#### Scenario: User-facing discovery shows shared governed name and description
- **WHEN** a governed product surface lists a managed skill for an end user on a specific bound agent
- **THEN** the system MUST show the managed skill's shared governed user-visible name together with the governed description for that skill
- **AND** the system MUST NOT expose the raw `SKILL.md` body or internal execution instructions to that end user

#### Scenario: Administrator edits basic governance metadata separately from agent binding
- **WHEN** an administrator views or edits display-surface metadata for a managed skill in the management UI
- **THEN** the UI MUST present `用户可见名称` inside the skill's `基础信息` governance section rather than inside each agent binding item
- **AND** the `Agent 绑定范围` section MUST only control which agents can load that skill
- **AND** the selectable governed surface labels MUST be `生产` and `测试`
- **AND** persisting those labels MUST continue to map to the existing managed surface policy without changing canonical skill package contents
