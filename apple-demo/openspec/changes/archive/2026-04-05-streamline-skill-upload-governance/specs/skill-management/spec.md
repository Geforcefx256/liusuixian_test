## MODIFIED Requirements

### Requirement: Managed skill registry SHALL govern imported standard skills
The system SHALL provide a managed skill registry that ingests canonical skill packages through a single-skill zip upload flow, preserves any canonical governed script manifest (`SCRIPTS.yaml`) packaged with the skill, and stores product-surface governance separately from the skill body while preserving the current managed `生产 / 测试` surface policy in this change.

#### Scenario: Uploading a valid skill zip creates or refreshes a managed record
- **WHEN** an administrator uploads one zip containing exactly one canonical skill package
- **THEN** the system MUST validate the package before writing it to canonical storage
- **AND** the system MUST persist the canonical package without adding governance fields to `SKILL.md` or `SCRIPTS.yaml`
- **AND** the system MUST create or refresh the managed skill record linked to that canonical skill
- **AND** the resulting managed record MUST remain compatible with the existing governed metadata contract and `生产 / 测试` surface policy

#### Scenario: Invalid skill zip is rejected before persistence
- **WHEN** an administrator uploads a zip that is empty, contains multiple skill roots, contains unsafe archive paths, lacks required files, has invalid frontmatter, or has an invalid `SCRIPTS.yaml`
- **THEN** the system MUST reject the upload with structured validation errors
- **AND** the system MUST NOT write the package into canonical skill storage
- **AND** the system MUST NOT mutate an existing managed governance record

#### Scenario: Overwrite conflict requires explicit confirmation
- **WHEN** an administrator uploads a canonical skill package whose `id` matches an existing canonical skill and replacement has not yet been confirmed
- **THEN** the system MUST return conflict details that include the existing `skillId`, canonical `name`, current governed surface state, and current bound agents
- **AND** the system MUST NOT overwrite the canonical package until the administrator explicitly confirms replacement

#### Scenario: Confirmed overwrite preserves current managed governance
- **WHEN** an administrator confirms replacement of an existing canonical skill package with the same `id`
- **THEN** the system MUST replace the canonical package with the uploaded contents
- **AND** the system MUST refresh canonical metadata derived from that package
- **AND** the system MUST preserve the existing governed display metadata, starter metadata, surface state, and agent bindings unless an administrator separately changes them

#### Scenario: Deleting a managed skill removes canonical package and governance
- **WHEN** an administrator confirms deletion of a managed skill
- **THEN** the system MUST delete the canonical package and its managed governance record together
- **AND** the deleted skill MUST no longer appear in managed administration or governed runtime surfaces after catalog reload

### Requirement: Canonical skill metadata SHALL require frontmatter name and description
The system SHALL require canonical `SKILL.md` frontmatter to provide string `id`, `name`, and `description` fields before that skill can be treated as a valid canonical skill.

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

#### Scenario: Alternate metadata does not replace canonical identity fields
- **WHEN** a canonical `SKILL.md` omits `id`, `name`, or `description` but includes other frontmatter fields such as `title`
- **THEN** the system MUST still treat that skill as invalid for canonical upload
- **AND** the system MUST NOT use alternate fields as silent replacements for the required canonical metadata
