## ADDED Requirements

### Requirement: Managed skills SHALL govern starter-card summary metadata
The system SHALL allow administrators to govern an optional starter-card summary for each managed skill separately from the governed display description, and SHALL expose that summary to managed starter surfaces through the managed skill metadata contract without changing the canonical skill package.

#### Scenario: Administrator saves starter summary separately from governed description
- **WHEN** an administrator updates a managed skill with a starter-card summary
- **THEN** the system MUST persist that summary as managed governance metadata separate from the governed display description
- **AND** updating the starter-card summary MUST NOT overwrite the governed display description unless that field is explicitly edited in the same save

#### Scenario: Starter summary remains outside the canonical skill package
- **WHEN** the system imports, updates, or re-syncs a canonical skill package
- **THEN** the canonical `SKILL.md` content and package structure MUST remain the execution source
- **AND** the governed starter-card summary MUST remain stored only in managed governance metadata

#### Scenario: Management UI exposes starter summary inside dedicated starter governance controls
- **WHEN** an administrator edits a managed skill in the skill management UI
- **THEN** the UI MUST present starter-surface controls in a dedicated governance section separate from generic description editing
- **AND** that section MUST include `作为首页代表 starter`, `意图分组`, `Starter 优先级`, and `快速开始摘要` controls
- **AND** the UI MUST provide a starter-card preview derived from the currently edited governed values

#### Scenario: Empty starter summary uses governed description as fallback metadata
- **WHEN** a managed skill is enabled as a starter and its governed starter-card summary is empty
- **THEN** the managed metadata exposed to starter-consuming surfaces MUST fall back to the governed display description
- **AND** the managed skill record MUST continue to preserve the starter summary as empty rather than auto-copying the description into that field
