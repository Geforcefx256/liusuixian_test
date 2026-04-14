## ADDED Requirements

### Requirement: Runtime skill preload surfaces SHALL use canonical parsed skill metadata
The runtime SHALL use the same validated canonical skill metadata for governed skill-tool discovery text, session skill preload instructions, planner skill summaries, and managed canonical metadata sync.

#### Scenario: Skill tool lists canonical skill name and description
- **WHEN** the runtime builds the governed skill-tool discovery description for available skills
- **THEN** each listed skill MUST use the canonical parsed `name` and `description` from its `SKILL.md`
- **AND** the runtime MUST NOT inject manifest-id or empty-string fallback metadata into that discovery surface

#### Scenario: Session and planner preload surfaces stay aligned
- **WHEN** the runtime injects available skill metadata into session preload instructions and planner skill summaries
- **THEN** those surfaces MUST use the same canonical parsed skill metadata as the skill catalog
- **AND** the runtime MUST NOT show different `name` or `description` values for the same canonical skill across those preload surfaces

### Requirement: Invalid canonical skill metadata SHALL be excluded from runtime discovery
The runtime SHALL exclude canonical skills with invalid or incomplete required metadata from governed runtime discovery surfaces instead of exposing degraded metadata.

#### Scenario: Invalid canonical skill is absent from runtime discovery
- **WHEN** a canonical skill package has invalid frontmatter or is missing required canonical metadata
- **THEN** the runtime MUST exclude that skill from available runtime skill discovery and preload surfaces
- **AND** the runtime MUST NOT advertise that skill with synthesized fallback metadata

#### Scenario: Managed canonical metadata mirrors only valid canonical skills
- **WHEN** managed skill governance syncs canonical metadata from packaged skills
- **THEN** the canonical name and description fields MUST reflect the parsed `SKILL.md` metadata for valid skills only
- **AND** invalid canonical skill metadata MUST NOT be mirrored as if it were a valid canonical skill identity
