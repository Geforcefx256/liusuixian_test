## ADDED Requirements

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
