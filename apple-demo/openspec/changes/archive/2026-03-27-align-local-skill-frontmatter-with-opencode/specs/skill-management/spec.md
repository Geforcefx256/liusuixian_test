## ADDED Requirements

### Requirement: Canonical skill metadata SHALL be parsed from YAML frontmatter
The system SHALL parse canonical `SKILL.md` metadata using YAML/frontmatter semantics for managed skill import and runtime canonical metadata resolution rather than using a line-oriented fallback parser.

#### Scenario: Quoted and colon-containing metadata values are parsed canonically
- **WHEN** a canonical `SKILL.md` defines `name` or `description` with quoted values or values containing `:`
- **THEN** the system MUST resolve those fields to their YAML-parsed string values
- **AND** the system MUST NOT preserve YAML quoting syntax or raw parser markers in canonical metadata

#### Scenario: Block-scalar description is parsed as description text
- **WHEN** a canonical `SKILL.md` defines `description` with a YAML block scalar such as `|`, `|-`, `>`, or `>-`
- **THEN** the system MUST resolve the canonical description to the resulting YAML string content
- **AND** the system MUST NOT expose the raw block-scalar marker as the description value

### Requirement: Canonical skill metadata SHALL require frontmatter name and description
The system SHALL require canonical `SKILL.md` frontmatter to provide string `name` and `description` fields before that skill can be treated as a valid canonical skill.

#### Scenario: Missing name invalidates canonical skill
- **WHEN** a canonical `SKILL.md` is missing frontmatter `name`
- **THEN** the system MUST treat that skill as invalid for canonical import and runtime discovery
- **AND** the system MUST NOT substitute the manifest skill id as the canonical name

#### Scenario: Missing description invalidates canonical skill
- **WHEN** a canonical `SKILL.md` is missing frontmatter `description`
- **THEN** the system MUST treat that skill as invalid for canonical import and runtime discovery
- **AND** the system MUST NOT substitute an empty string as the canonical description

#### Scenario: Alternate display fields do not replace canonical name
- **WHEN** a canonical `SKILL.md` omits `name` but includes other frontmatter fields such as `title`
- **THEN** the system MUST still treat that skill as invalid for canonical import
- **AND** the system MUST NOT use alternate display fields as a silent replacement for canonical `name`
