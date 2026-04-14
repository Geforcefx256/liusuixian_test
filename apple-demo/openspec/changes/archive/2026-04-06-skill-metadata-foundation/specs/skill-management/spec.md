## MODIFIED Requirements

### Requirement: Managed skill registry SHALL govern imported standard skills
The system SHALL provide a managed skill registry that ingests canonical skill packages through a single-skill zip upload flow, preserves any canonical governed script manifest (`SCRIPTS.yaml`) packaged with the skill, mirrors supported canonical skill metadata into the managed record, and stores product-surface governance separately from the skill body.

#### Scenario: Uploading a valid skill zip creates a draft managed record with canonical metadata mirror
- **WHEN** an administrator uploads one zip containing exactly one canonical skill package
- **THEN** the system MUST validate the package before writing it to canonical storage
- **AND** the system MUST persist the canonical package without adding governance fields to `SKILL.md` or `SCRIPTS.yaml`
- **AND** the system MUST create or rebuild the managed skill record linked to that canonical skill
- **AND** the managed record MUST mirror the supported canonical metadata fields from `SKILL.md`
- **AND** the managed record MUST start in `draft` with empty governed display metadata, empty starter metadata, and no agent bindings

#### Scenario: Confirmed overwrite resets managed governance and refreshes canonical metadata mirror
- **WHEN** an administrator confirms replacement of an existing canonical skill package with the same `id`
- **THEN** the system MUST replace the canonical package with the uploaded contents
- **AND** the system MUST rebuild the mirrored canonical metadata from the replacement package
- **AND** the system MUST reset the managed skill to `draft`
- **AND** the system MUST clear governed display metadata, starter metadata, and agent bindings before the replacement becomes available for further governance

### Requirement: Canonical skill metadata SHALL be parsed from YAML frontmatter
The system SHALL parse canonical `SKILL.md` metadata using YAML/frontmatter semantics for managed skill import and runtime canonical metadata resolution, and SHALL accept only the canonical frontmatter field names defined by the skill metadata foundation contract.

#### Scenario: Quoted and colon-containing metadata values are parsed canonically
- **WHEN** a canonical `SKILL.md` defines `name`, `description`, or another supported canonical string field with quoted values or values containing `:`
- **THEN** the system MUST resolve those fields to their YAML-parsed string values
- **AND** the system MUST NOT preserve YAML quoting syntax or raw parser markers in canonical metadata

#### Scenario: Block-scalar description is parsed as description text
- **WHEN** a canonical `SKILL.md` defines `description` with a YAML block scalar such as `|`, `|-`, `>`, or `>-`
- **THEN** the system MUST resolve the canonical description to the resulting YAML string content
- **AND** the system MUST NOT expose the raw block-scalar marker as the description value

#### Scenario: Legacy multi-word field aliases are not accepted as canonical metadata
- **WHEN** a canonical `SKILL.md` uses legacy mixed-style field names such as `inputExample`, `outputExample`, or `when_to_use`
- **THEN** the system MUST NOT treat those fields as valid canonical metadata aliases
- **AND** the system MUST require the canonical field names defined by the metadata foundation contract instead

### Requirement: Canonical skill metadata SHALL require frontmatter name and description
The system SHALL require canonical `SKILL.md` frontmatter to provide string `id`, `name`, and `description` fields, SHALL allow optional metadata fields to be omitted, and SHALL reject governed product-surface metadata from entering canonical skill packages.

#### Scenario: Missing id invalidates canonical skill
- **WHEN** a canonical `SKILL.md` is missing frontmatter `id`
- **THEN** the system MUST treat that skill as invalid for canonical upload and runtime discovery
- **AND** the system MUST NOT infer the canonical identity from the zip filename, directory name, or any external manifest

#### Scenario: Missing name invalidates canonical skill
- **WHEN** a canonical `SKILL.md` is missing frontmatter `name`
- **THEN** the system MUST treat that skill as invalid for canonical upload and runtime discovery
- **AND** the system MUST NOT substitute the canonical `id` as the canonical name

#### Scenario: Missing description invalidates canonical skill
- **WHEN** a canonical `SKILL.md` is missing frontmatter `description`
- **THEN** the system MUST treat that skill as invalid for canonical upload and runtime discovery
- **AND** the system MUST NOT substitute an empty string as the canonical description

#### Scenario: Missing optional metadata still yields a valid canonical skill
- **WHEN** a canonical `SKILL.md` provides `id`, `name`, and `description` but omits optional metadata such as `when-to-use`, `input-example`, `output-example`, `allowed-tools`, `user-invocable`, `disable-model-invocation`, `model`, `effort`, or `context`
- **THEN** the system MUST still treat that skill as a valid canonical skill
- **AND** the system MUST preserve those omitted fields as absent rather than synthesizing fallback runtime-policy values

#### Scenario: Governed metadata fields are rejected from canonical skills
- **WHEN** a canonical `SKILL.md` includes governed product-surface fields such as display metadata, starter metadata, lifecycle metadata, or agent-binding metadata
- **THEN** the system MUST reject that skill as invalid for canonical upload
- **AND** the system MUST require those governed fields to remain in managed registry storage rather than in the canonical package

#### Scenario: Alternate metadata does not replace canonical identity fields
- **WHEN** a canonical `SKILL.md` omits `id`, `name`, or `description` but includes other frontmatter fields
- **THEN** the system MUST still treat that skill as invalid for canonical upload
- **AND** the system MUST NOT use alternate fields as silent replacements for the required canonical metadata
