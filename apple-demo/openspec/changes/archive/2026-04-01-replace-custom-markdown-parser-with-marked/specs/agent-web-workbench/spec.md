## MODIFIED Requirements

### Requirement: Workbench SHALL provide Markdown preview in the workspace editor
The workbench SHALL provide a dedicated Markdown preview path for workspace files identified as Markdown and SHALL default those files into preview whenever they become the current active workspace file, so users can review rendered document structure without leaving the workspace shell. The Markdown preview renderer SHALL use marked for GFM-compatible parsing and DOMPurify for output sanitization, and SHALL support GFM tables and strikethrough in addition to the previously supported inline and block structures.

#### Scenario: Markdown file defaults to preview when activated
- **WHEN** the user opens or re-activates a Markdown workspace file in the expanded shell
- **THEN** the editor MUST show the preview view by default for that file
- **AND** the editor MUST still provide an edit view for that same file inside the standard workspace shell

#### Scenario: Markdown file can switch between edit and preview views
- **WHEN** the user switches a Markdown workspace file into edit view and later returns it to preview view
- **THEN** the editor MUST provide both an edit view and a preview view for that file
- **AND** switching to preview MUST render the current workspace file content rather than a stale saved snapshot

#### Scenario: Markdown re-activation does not depend on remembered per-file view state
- **WHEN** the user manually switches a Markdown workspace file into edit view, activates another file, and later re-activates the original Markdown file
- **THEN** the editor MUST return that Markdown file to preview by default
- **AND** the workbench MUST NOT require per-file remembered view state to restore the Markdown default

#### Scenario: Markdown preview remains inside the standard workspace shell
- **WHEN** the user views a Markdown workspace file in preview view
- **THEN** the workbench MUST keep the surrounding workspace shell, tabs, save controls, and conversation surface visible
- **AND** the workbench MUST NOT navigate the user into a separate document page or standalone viewer

#### Scenario: Markdown preview renders GFM tables
- **WHEN** the preview content contains a GFM table with pipe-delimited rows and a separator row
- **THEN** the preview MUST render that table as an HTML table with visible header cells and body rows
- **AND** the table MUST NOT appear as raw pipe-delimited text

#### Scenario: Markdown preview renders GFM strikethrough
- **WHEN** the preview content contains text wrapped in double tildes such as `~~deleted~~`
- **THEN** the preview MUST render that text with a strikethrough presentation

#### Scenario: Markdown preview preserves raw-HTML-as-literal-text behavior
- **WHEN** the preview content contains raw HTML tags such as `<script>alert(1)</script>`
- **THEN** the preview MUST display those tags as escaped literal text
- **AND** the preview MUST NOT render those tags as effective HTML elements

#### Scenario: Markdown preview filters non-whitelisted link protocols
- **WHEN** the preview content contains a link whose href uses a protocol outside `http`, `https`, `mailto`, `#` anchor, or `/` relative path
- **THEN** the preview MUST NOT render that link as a clickable `<a>` element
- **AND** the preview MUST display only the link text as plain text

### Requirement: Workbench SHALL support reading mode for eligible assistant plain-text messages
The authenticated workbench SHALL evaluate completed assistant plain-text messages for reading-mode eligibility and SHALL render eligible messages through a readable markdown-like presentation while keeping short conversational replies in the existing bubble-style presentation. For ordinary multiline text that is rendered through this reading-mode path, the workbench MUST preserve visible line breaks from the original message content instead of collapsing those source newlines into a single visual line. The reading-mode renderer SHALL use marked for GFM-compatible parsing and DOMPurify for output sanitization.

#### Scenario: Structured assistant plain-text reply defaults into reading mode
- **WHEN** the conversation contains a completed assistant plain-text message with strong structured-text signals such as markdown headings, code fences, multi-item lists, GFM table syntax, or longer blank-line-separated paragraphs
- **THEN** the conversation surface MUST render that message through the readable reading-mode presentation by default
- **AND** the frontend MUST NOT require a backend-specific message kind or persisted presentation hint in order to do so

#### Scenario: Reading mode preserves visible line breaks from multiline assistant text
- **WHEN** an eligible completed assistant plain-text message contains source line breaks inside ordinary text content rendered by the reading-mode surface
- **THEN** the conversation surface MUST preserve those source line breaks as visible line breaks in the rendered message body
- **AND** the frontend MUST NOT flatten that multiline content into a single visual line solely because the message entered reading mode

#### Scenario: Table-only assistant reply defaults into reading mode
- **WHEN** the conversation contains a completed assistant plain-text message whose content consists of a GFM table (pipe-delimited rows with a separator row) and no other strong structural signals such as headings or code fences
- **THEN** the conversation surface MUST render that message through the reading-mode presentation by default
- **AND** the rendered output MUST display the table as an HTML table rather than raw pipe-delimited text

#### Scenario: Short conversational assistant reply stays in the normal bubble path
- **WHEN** the conversation contains a completed assistant plain-text message that reads like a short conversational reply and does not satisfy the frontend's reading-mode eligibility rules
- **THEN** the conversation surface MUST keep that message in the normal plain bubble presentation
- **AND** the workbench MUST NOT force every completed assistant plain-text message into the reading-mode surface

#### Scenario: Streaming assistant text does not switch presentation mid-generation
- **WHEN** an assistant plain-text message is still streaming for the active turn
- **THEN** the conversation surface MUST keep using the existing in-flight text presentation until the message is complete
- **AND** the frontend MUST NOT reflow the message between raw and reading-mode layouts during streaming

#### Scenario: Wide table scrolls horizontally inside assistant reading-mode bubble
- **WHEN** a completed assistant plain-text message rendered in reading mode contains a GFM table that exceeds the available bubble width
- **THEN** the table MUST be horizontally scrollable without breaking the surrounding bubble layout
- **AND** the table content MUST NOT be truncated or hidden

#### Scenario: Bare URLs render as clickable links in reading mode
- **WHEN** a completed assistant plain-text message rendered in reading mode contains a bare URL such as `https://example.com`
- **THEN** the reading-mode surface MUST render that URL as a clickable link
- **AND** this behavior change from the previous custom parser is accepted as product behavior

#### Scenario: Reading mode preserves raw-HTML-as-literal-text behavior
- **WHEN** a completed assistant plain-text message rendered in reading mode contains raw HTML tags such as `<script>alert(1)</script>`
- **THEN** the reading-mode surface MUST display those tags as escaped literal text
- **AND** the surface MUST NOT render those tags as effective HTML elements
