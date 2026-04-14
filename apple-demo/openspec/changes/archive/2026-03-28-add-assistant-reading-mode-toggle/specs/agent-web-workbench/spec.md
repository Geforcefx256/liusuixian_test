## ADDED Requirements

### Requirement: Workbench SHALL support reading mode for eligible assistant plain-text messages
The authenticated workbench SHALL evaluate completed assistant plain-text messages for reading-mode eligibility and SHALL render eligible messages through a readable markdown-like presentation while keeping short conversational replies in the existing bubble-style presentation.

#### Scenario: Structured assistant plain-text reply defaults into reading mode
- **WHEN** the conversation contains a completed assistant plain-text message with strong structured-text signals such as markdown headings, code fences, multi-item lists, or longer blank-line-separated paragraphs
- **THEN** the conversation surface MUST render that message through the readable reading-mode presentation by default
- **AND** the frontend MUST NOT require a backend-specific message kind or persisted presentation hint in order to do so

#### Scenario: Short conversational assistant reply stays in the normal bubble path
- **WHEN** the conversation contains a completed assistant plain-text message that reads like a short conversational reply and does not satisfy the frontend's reading-mode eligibility rules
- **THEN** the conversation surface MUST keep that message in the normal plain bubble presentation
- **AND** the workbench MUST NOT force every completed assistant plain-text message into the reading-mode surface

#### Scenario: Streaming assistant text does not switch presentation mid-generation
- **WHEN** an assistant plain-text message is still streaming for the active turn
- **THEN** the conversation surface MUST keep using the existing in-flight text presentation until the message is complete
- **AND** the frontend MUST NOT reflow the message between raw and reading-mode layouts during streaming

### Requirement: Workbench SHALL allow a low-profile manual view toggle for eligible assistant plain-text messages
The authenticated workbench SHALL expose a low-profile per-message view toggle for eligible completed assistant plain-text messages so the user can switch between rendered reading mode and raw text without affecting other messages.

#### Scenario: Eligible assistant message shows a manual view toggle near timestamp
- **WHEN** the conversation renders a completed assistant plain-text message that is eligible for reading mode
- **THEN** the message metadata area near the timestamp MUST expose a subtle manual view toggle such as `阅读` or `原文`
- **AND** that toggle MUST apply only to the owning message rather than to the whole conversation

#### Scenario: User can switch an eligible message back to raw text
- **WHEN** the user activates the manual view toggle on an eligible assistant plain-text message currently shown in reading mode
- **THEN** the conversation surface MUST switch that message back to the raw plain-text presentation
- **AND** the surrounding conversation state MUST remain unchanged

#### Scenario: Manual view toggle is not persisted as backend session state
- **WHEN** the user manually switches an eligible assistant plain-text message between reading mode and raw text and later reloads or reopens the session
- **THEN** the workbench MUST recompute the default presentation from message content rather than restoring the earlier manual override
- **AND** the frontend MUST NOT require backend-persisted per-message view state for that toggle

#### Scenario: Structured non-text assistant surfaces remain on their dedicated renderers
- **WHEN** the conversation contains assistant messages whose visible body is owned by protocol, rich result, or failure-specific rendering paths
- **THEN** the workbench MUST continue to render those messages through their existing dedicated message surfaces
- **AND** the assistant plain-text reading-mode toggle MUST NOT replace or interfere with those structured renderers
