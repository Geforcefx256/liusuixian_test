## MODIFIED Requirements

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

#### Scenario: Skill list uses compact A2 governance-list styling
- **WHEN** an administrator scans the governed skill list in desktop layout
- **THEN** each skill item MUST render as a compact governance list item with a title row, a two-line summary cap, and a single-line metadata row
- **AND** the currently selected item MUST use a left-side accent rail together with a light highlight state instead of relying on a heavy elevated card treatment

#### Scenario: Governance sections use compact control and container density
- **WHEN** an administrator views the `Skill 管理` header, metadata strip, detail sections, starter preview, or agent-binding list
- **THEN** those surfaces MUST use a compact workbench-aligned density with reduced padding, reduced corner radius, and smaller status-pill/control shells relative to the current typography scale
- **AND** the page MUST preserve clear readability without introducing larger text to compensate for oversized containers
