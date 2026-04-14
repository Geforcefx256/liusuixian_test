# skill-management Specification

## Purpose
Define the governance, canonical metadata requirements, and runtime exposure rules for managed skills.
## Requirements
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

### Requirement: Canonical skill uploads SHALL reject conflicting canonical identity
The system SHALL treat canonical skill `id` and canonical skill `name` as reserved identities during managed skill ZIP upload because governed runtime surfaces and tooling may resolve canonical skills by either field.

#### Scenario: Same id upload requires explicit overwrite confirmation
- **WHEN** an administrator uploads a canonical skill package whose `id` already exists and the request does not confirm overwrite
- **THEN** the system MUST reject the upload with `409`
- **AND** the conflict response MUST include `reason` set to `id`
- **AND** the conflict response MUST identify the existing managed skill for administrator review before any overwrite retry

#### Scenario: Same name on a different id is rejected explicitly
- **WHEN** an administrator uploads a canonical skill package whose `name` already exists on a different canonical `id`
- **THEN** the system MUST reject the upload with `409`
- **AND** the conflict response MUST include `reason` set to `name`
- **AND** the system MUST NOT persist the uploaded package or mutate any managed governance state

#### Scenario: Overwrite cannot bypass a name conflict
- **WHEN** an administrator submits `/agent/api/admin/skills/upload?overwrite=true` but the uploaded package still conflicts on canonical `name` with a different existing skill
- **THEN** the system MUST continue to reject the upload as a `name` conflict
- **AND** the system MUST NOT replace any canonical package as part of that request

### Requirement: Skill management upload conflict UI SHALL distinguish overwriteable and blocking conflicts
The skill management UI SHALL present a generic canonical conflict surface for managed skill uploads while disclosing whether the conflict is caused by canonical `id` or canonical `name`, and SHALL only offer overwrite retry for overwrite-safe `id` conflicts.

#### Scenario: Id conflict keeps explicit overwrite confirmation
- **WHEN** the management UI receives a managed skill upload conflict with `reason = id`
- **THEN** the UI MUST state that the conflict is caused by an existing canonical `id`
- **AND** the UI MUST keep the explicit overwrite confirmation action available

#### Scenario: Name conflict blocks overwrite retry
- **WHEN** the management UI receives a managed skill upload conflict with `reason = name`
- **THEN** the UI MUST state that the conflict is caused by an existing canonical `name`
- **AND** the UI MUST NOT present the overwrite confirmation action for that conflict

### Requirement: Managed skill upload API SHALL normalize upload middleware failures
The admin skill upload API SHALL return structured JSON error payloads for upload middleware failures so that the skill management UI can handle invalid file selections and multipart failures through the same product-owned error path used for other upload validation responses.

#### Scenario: Non-ZIP file rejection remains structured
- **WHEN** an administrator submits a non-ZIP file to `/agent/api/admin/skills/upload`
- **THEN** the API MUST respond with JSON rather than raw middleware text or an HTML error page
- **AND** the response payload MUST include stable `error` and `code` fields

#### Scenario: Multipart middleware failure remains structured
- **WHEN** multipart parsing or upload middleware fails before business validation completes
- **THEN** the API MUST respond with JSON rather than exposing raw middleware output
- **AND** frontend consumers MUST be able to handle that failure through the existing structured upload-error branch

### Requirement: Managed skills SHALL define agent binding and governed display metadata
The system SHALL allow administrators to bind managed skills to specific agents while governing a single skill-level user-visible name, governed description, starter metadata, and lifecycle state used in managed product surfaces.

#### Scenario: Administrator edits basic governance metadata separately from agent binding
- **WHEN** an administrator views or edits governance metadata for a managed skill in the management UI
- **THEN** the UI MUST present `用户可见名称` inside the skill's `基础信息` governance section rather than inside each agent binding item
- **AND** the `Agent 绑定范围` section MUST only control which agents can load that skill
- **AND** the selectable lifecycle labels MUST be `草稿` and `已发布`
- **AND** persisting those labels MUST map to the managed `draft / published` lifecycle without changing canonical skill package contents

### Requirement: Managed skill governance SHALL remain authoritative for runtime skill exposure
The system SHALL continue to use managed skill governance as the authoritative source for which canonical skills and governed script templates are exposed to an agent runtime surface and to governed product metadata after the backend capability migration.

#### Scenario: Governed agent catalog still resolves managed skill records
- **WHEN** the migrated backend builds agent detail or execution catalog data for an agent
- **THEN** the runtime MUST continue to resolve the visible skill set from managed skill governance for that agent
- **AND** governed display metadata from the managed registry MUST continue to override raw canonical skill metadata in governed product surfaces

#### Scenario: Governed script templates follow the same approval boundary
- **WHEN** the runtime materializes executable script templates from canonical skill packages
- **THEN** it MUST expose those templates only for skills that are approved for the current governed runtime surface
- **AND** it MUST treat unapproved skill scripts as unavailable even when their canonical `SCRIPTS.yaml` exists locally

#### Scenario: Skill and script access both reject known but unapproved skills
- **WHEN** a request asks the runtime to load a canonical skill body or invoke a canonical script from a skill that exists in the catalog but is not approved for the current governed runtime surface
- **THEN** the runtime MUST reject that request as an unapproved skill access
- **AND** the runtime MUST NOT expose the raw `SKILL.md` body or executable script metadata for that denied skill through the governed execution path

### Requirement: Managed skill governance SHALL coexist with runtime tool deny policy
The system SHALL allow runtime tool deny policy to coexist with managed skill governance without replacing the governance layer or weakening its authorization semantics.

#### Scenario: Tool deny policy blocks tools after governance filtering
- **WHEN** the runtime builds a tool catalog for an agent request
- **THEN** the runtime MAY apply tool deny policy after the governed skill and tool surface is resolved
- **AND** the deny policy MUST NOT be treated as a replacement for managed skill approval and binding rules

#### Scenario: Managed skill administration remains available with deny policy enabled
- **WHEN** runtime tool deny policy is enabled in the migrated backend
- **THEN** administrators MUST still be able to import, inspect, and update managed skill records through the current admin skill APIs
- **AND** enabling deny policy MUST NOT disable managed skill governance workflows

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

### Requirement: Managed skill governance detail SHALL remain reachable inside the viewport-constrained admin shell
The system SHALL keep the `Skill 管理` detail experience fully reachable inside the viewport-constrained workbench shell. When managed-skill governance content exceeds the available height or a starter-governance section introduces denser controls, the admin view MUST provide pane-owned scrolling and responsive reflow instead of clipping the detail content or forcing controls beyond the visible range, and the same page MUST present a compact governance density that matches the workbench text hierarchy rather than oversized card shells.

#### Scenario: Governance detail content scrolls inside the detail pane
- **WHEN** an administrator opens a managed skill whose governance detail content is taller than the available viewport height
- **THEN** the `治理详情` pane MUST expose its own vertical scrolling path inside the admin shell
- **AND** the administrator MUST be able to reach the full `首页卡片治理` section and its preview content without the shell clipping the lower portion of the form

#### Scenario: Skill list and governance detail do not depend on page-level scrolling
- **WHEN** the managed skill list and the selected governance detail both contain more content than can fit in the current viewport
- **THEN** the admin skill list and governance detail MUST remain usable within the shell through pane-owned scrolling
- **AND** the interaction MUST NOT require restoring a browser-level full-page vertical scrollbar for the entire workbench shell

#### Scenario: Starter governance controls reflow before overflowing the visible width
- **WHEN** the available width is too narrow to display the `作为首页代表 starter` toggle, intent-group selector, priority field, summary editor, and preview content side by side in their preferred layout
- **THEN** the `Starter 摘要与预览` section MUST reflow its controls into a narrower layout that remains fully visible
- **AND** the UI MUST NOT push the governance card beyond the browser's visible width or hide content behind horizontal clipping

#### Scenario: Governance sections use compact control and container density
- **WHEN** an administrator views the `Skill 管理` header, metadata strip, detail sections, starter preview, or agent-binding list
- **THEN** those surfaces MUST use a compact workbench-aligned density with reduced padding, reduced corner radius, and smaller status-pill/control shells relative to the current typography scale
- **AND** the page MUST preserve clear readability without introducing larger text to compensate for oversized containers

### Requirement: Skill management sidebar SHALL use summary-card navigation
The system SHALL render the left pane of the skill management page as a summary-card rail for all managed skill datasets. The rail MUST preserve skill selection behavior without rendering the legacy governance-list heading, search field, lifecycle filter, or draft/published counters.

#### Scenario: One managed skill shows a single summary card
- **WHEN** an administrator opens the skill management page and the managed skill dataset contains exactly one skill
- **THEN** the left pane MUST render a summary-card rail with exactly one skill summary card
- **AND** the left pane MUST NOT render the governance-list heading, search field, lifecycle filter, or draft/published counters

#### Scenario: Multi-skill datasets keep explicit selection through summary cards
- **WHEN** an administrator opens the skill management page and the managed skill dataset contains two or more skills
- **THEN** the left pane MUST render one clickable summary card per managed skill
- **AND** selecting a summary card MUST switch the right-side governance detail to the corresponding managed skill

### Requirement: Summary cards SHALL only expose lightweight governance state
The system SHALL keep the left summary cards focused on lightweight governance state. They MUST avoid repeating canonical identity and agent-binding metadata that are already available in the detail pane.

#### Scenario: Summary card titles use governed display name or explicit placeholder
- **WHEN** a managed skill is rendered in the left summary rail
- **THEN** the summary card title MUST use the governed `displayName`
- **AND** when `displayName` is empty the title MUST show `待填写用户可见名称`
- **AND** the UI MUST NOT silently fall back to `canonicalName`, `skillId`, or an empty title in that location

#### Scenario: Summary cards only show allowed governance fields
- **WHEN** a managed skill is rendered in the left summary rail
- **THEN** the summary card MUST include lifecycle state and Starter enabled state
- **AND** the summary card MUST show the localized intent-group label only if Starter is enabled for that skill
- **AND** the summary card MUST NOT include `canonicalName`, `skillId`, source agent, or bound-agent count

### Requirement: Managed skill administration SHALL align typography with workbench surfaces
The system SHALL present the `Skill 管理` page inside the workbench shell using the same typography hierarchy as existing workbench surfaces, so that administrators do not encounter a separate visual language when switching between `工作台` and `Skill 管理`.

#### Scenario: Skill management hero copy follows workbench supporting-text scale
- **WHEN** an administrator views the `Skill 管理` hero area inside the workbench shell
- **THEN** the page title MUST continue to use the workbench page-title hierarchy
- **AND** the supporting explanation text below that title MUST use the same supporting-text scale used by existing workbench surfaces rather than a looser body-text hierarchy unique to the admin page

#### Scenario: Governance section headings follow workbench section-title hierarchy
- **WHEN** an administrator scans the `治理详情` pane and encounters structural headings such as `治理说明与展示状态` or `Starter 摘要与预览`
- **THEN** those structural headings MUST use the same section-title hierarchy used by workbench cards and panes
- **AND** the page MUST NOT style those headings as generic body copy

#### Scenario: Skill names and supporting metadata retain workbench text roles
- **WHEN** the page renders managed-skill names, governed binding names, summaries, field labels, hints, and metadata in the list or detail panes
- **THEN** the primary names and summaries MUST map to the same dense control/content text roles used elsewhere in the workbench
- **AND** labels, hints, and secondary metadata MUST map to the same meta-text role used elsewhere in the workbench instead of introducing a page-specific typography scale

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
