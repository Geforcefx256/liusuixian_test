## ADDED Requirements

### Requirement: Runtime build execution SHALL inject a budgeted skill listing reminder
The runtime SHALL inject a model-facing skill listing reminder for build/executor requests as a conversation reminder message based on the governed skill set already available to the current request, and SHALL keep full skill bodies behind explicit `skill:skill` loading.

#### Scenario: Executor reminder lists governed skills with summary-only fields
- **WHEN** the runtime prepares a build/executor model invocation for a request that has governed `availableSkills`
- **THEN** it MUST inject a skill listing reminder message derived from that governed skill set
- **AND** each listed skill MUST be summarized only by canonical `name`, `description`, and `when-to-use` when present
- **AND** the reminder MUST NOT inline the full `SKILL.md` body or unrelated metadata fields
- **AND** the reminder MUST NOT be appended to the top-level system prompt body for that request

#### Scenario: Skill tool remains the full-skill loading path
- **WHEN** the runtime exposes the `skill` tool during the same request
- **THEN** the tool description MUST provide static usage guidance rather than inlining the current skill catalog
- **AND** a full `SKILL.md` body MUST be returned only after the model explicitly loads an approved skill through the existing `skill:skill` path

#### Scenario: Discovery remains explicitly disabled in the first listing change
- **WHEN** the runtime builds the skill listing reminder in this change
- **THEN** it MUST treat discovery mode as `disabled` and use the current governed `availableSkills` as the input set
- **AND** discovery mode MAY remain an internal diagnostic/logging field rather than a model-visible reminder line
- **AND** any skill omitted from the final reminder MUST be attributable to explicit budget trimming or skipping rather than hidden relevance filtering

### Requirement: Runtime skill listing budgeting SHALL be explicit and observable
The runtime SHALL apply an explicit bounded budget to skill listing reminders and SHALL emit structured logs that explain how the reminder was built, trimmed, skipped, and injected.

#### Scenario: Oversized skill summary is trimmed predictably
- **WHEN** a skill summary would exceed the configured single-entry or total reminder budget
- **THEN** the runtime MUST trim or skip that summary according to the listing budget policy
- **AND** it MUST preserve the skill identity needed for the model to request that skill explicitly later

#### Scenario: Listing injection emits budget diagnostics
- **WHEN** the runtime injects a skill listing reminder into a build/executor model request
- **THEN** it MUST emit structured logs that distinguish listing-built, entry-trimmed, and reminder-injected events
- **AND** those logs MUST expose the source skill count, included skill count, trimmed skill count, discovery mode, reminder budget size, and reminder injection surface needed to debug listing behavior
