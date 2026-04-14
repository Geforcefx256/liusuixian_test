## ADDED Requirements

### Requirement: Managed skills SHALL control draft and published lifecycle policy
The system SHALL maintain each managed skill in either `draft` or `published`, with `draft` as the default state after upload or overwrite reset and `published` as the only lifecycle state exposed to governed runtime surfaces by default.

#### Scenario: New upload starts as draft
- **WHEN** an administrator uploads a valid canonical skill package
- **THEN** the managed skill record MUST start in `draft`
- **AND** the managed skill MUST NOT become visible to governed runtime surfaces until it is explicitly published

#### Scenario: Publishing requires completed governance and bindings
- **WHEN** an administrator attempts to publish a managed skill
- **THEN** the system MUST require non-empty governed display name and governed display description together with at least one bound agent
- **AND** the managed skill MUST remain in `draft` if any of those conditions are missing

## MODIFIED Requirements

### Requirement: Managed skill registry SHALL govern imported standard skills
The system SHALL provide a managed skill registry that ingests canonical skill packages through a single-skill zip upload flow, preserves any canonical governed script manifest (`SCRIPTS.yaml`) packaged with the skill, and stores product-surface governance separately from the skill body.

#### Scenario: Uploading a valid skill zip creates a draft managed record
- **WHEN** an administrator uploads one zip containing exactly one canonical skill package
- **THEN** the system MUST validate the package before writing it to canonical storage
- **AND** the system MUST persist the canonical package without adding governance fields to `SKILL.md` or `SCRIPTS.yaml`
- **AND** the system MUST create or rebuild the managed skill record linked to that canonical skill
- **AND** the managed record MUST start in `draft` with empty governed display metadata, empty starter metadata, and no agent bindings

#### Scenario: Confirmed overwrite resets managed governance
- **WHEN** an administrator confirms replacement of an existing canonical skill package with the same `id`
- **THEN** the system MUST replace the canonical package with the uploaded contents
- **AND** the system MUST reset the managed skill to `draft`
- **AND** the system MUST clear governed display metadata, starter metadata, and agent bindings before the replacement becomes available for further governance

### Requirement: Managed skills SHALL define agent binding and governed display metadata
The system SHALL allow administrators to bind managed skills to specific agents while governing a single skill-level user-visible name, governed description, starter metadata, and lifecycle state used in managed product surfaces.

#### Scenario: Administrator edits basic governance metadata separately from agent binding
- **WHEN** an administrator views or edits governance metadata for a managed skill in the management UI
- **THEN** the UI MUST present `用户可见名称` inside the skill's `基础信息` governance section rather than inside each agent binding item
- **AND** the `Agent 绑定范围` section MUST only control which agents can load that skill
- **AND** the selectable lifecycle labels MUST be `草稿` and `已发布`
- **AND** persisting those labels MUST map to the managed `draft / published` lifecycle without changing canonical skill package contents

## REMOVED Requirements

### Requirement: Managed skills SHALL control production versus experimental surface policy
**Reason**: The lifecycle model is changing from `生产 / 测试` surface toggles to explicit `draft / published` governance states, with upload and overwrite resetting the managed skill to `draft`.
**Migration**: Map existing `生产` records to `published` and existing `测试` records to `draft`, then enforce publication through the new lifecycle prerequisites.
