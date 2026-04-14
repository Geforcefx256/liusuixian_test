## ADDED Requirements

### Requirement: Workbench SHALL use a governed typography system across shell and workspace surfaces
The authenticated workbench SHALL use a governed typography system so that shell chrome, conversation surfaces, workspace surfaces, and administrative panels express hierarchy through a small semantic type scale rather than component-local raw size choices.

#### Scenario: Similar shell roles use the same governed typography tier
- **WHEN** the workbench renders repeated hierarchy roles such as eyebrows, meta text, dense list text, panel titles, and section titles across different components
- **THEN** those roles MUST resolve from a shared governed typography scale
- **AND** the frontend MUST NOT rely on unrelated component-local raw font sizes for equivalent hierarchy levels

#### Scenario: Dense operational UI avoids low-value micro-variants
- **WHEN** the workbench renders dense operational surfaces such as rails, sidebars, drawers, cards, and shell controls
- **THEN** the typography system MUST avoid low-value micro-variants such as mixed `10px`, `15px`, `17px`, or narrow small-size responsive clamps for those normal chrome roles
- **AND** the workbench MUST prefer a small semantic size set that keeps hierarchy legible on laptop and desktop widths

### Requirement: Workspace editing surfaces SHALL keep editor and table typography distinct but internally consistent
The workbench SHALL keep editor typography and table typography as governed but separate surface rules so that text editing, structured table browsing, and table editing remain density-stable inside the workspace shell.

#### Scenario: Monaco-backed text editing uses the governed editor typography
- **WHEN** the user opens a text-class workspace file in the Monaco-backed text path
- **THEN** the editor MUST use the governed monospace editor typography for that surface
- **AND** any fallback raw-text editing path MUST use the same editor typography role

#### Scenario: Table-oriented workspace surfaces use the governed table typography
- **WHEN** the user views structured data through the workspace table path, the MML workbook grid, or workbench result tables
- **THEN** those table-oriented surfaces MUST use the governed table typography role rather than inheriting unrelated body or editor typography
- **AND** supporting table metadata such as pills, statuses, or row notes MUST use the governed table-meta role

#### Scenario: Entering table edit mode does not change text hierarchy
- **WHEN** the user edits a value inside a governed table-oriented surface
- **THEN** the edit control MUST preserve the same core typography role as the table cell's browse state
- **AND** entering edit mode MUST NOT cause a visible typography jump solely because the surface switched from read-only display to input control

### Requirement: Markdown preview SHALL keep a document-scoped typography scale inside the workspace shell
The workbench SHALL scope Markdown preview to a document-oriented typography scale without letting that document scale redefine surrounding shell chrome.

#### Scenario: Markdown preview uses a stronger heading scale than shell chrome
- **WHEN** the user switches a Markdown workspace file into preview view
- **THEN** the preview MUST render headings and prose through a document-scoped typography scale appropriate for document reading
- **AND** the surrounding workbench shell MUST continue to use the governed shell typography rather than inheriting Markdown heading sizes
