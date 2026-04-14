## MODIFIED Requirements

### Requirement: Workbench SHALL support reading mode for eligible assistant plain-text messages
The authenticated workbench SHALL evaluate completed assistant plain-text messages for reading-mode eligibility and SHALL render eligible messages through a readable markdown-like presentation while keeping short conversational replies in the existing bubble-style presentation. For ordinary multiline text that is rendered through this reading-mode path, the workbench MUST preserve visible line breaks from the original message content instead of collapsing those source newlines into a single visual line.

#### Scenario: Structured assistant plain-text reply defaults into reading mode
- **WHEN** the conversation contains a completed assistant plain-text message with strong structured-text signals such as markdown headings, code fences, multi-item lists, or longer blank-line-separated paragraphs
- **THEN** the conversation surface MUST render that message through the readable reading-mode presentation by default
- **AND** the frontend MUST NOT require a backend-specific message kind or persisted presentation hint in order to do so

#### Scenario: Reading mode preserves visible line breaks from multiline assistant text
- **WHEN** an eligible completed assistant plain-text message contains source line breaks inside ordinary text content rendered by the reading-mode surface
- **THEN** the conversation surface MUST preserve those source line breaks as visible line breaks in the rendered message body
- **AND** the frontend MUST NOT flatten that multiline content into a single visual line solely because the message entered reading mode

#### Scenario: Short conversational assistant reply stays in the normal bubble path
- **WHEN** the conversation contains a completed assistant plain-text message that reads like a short conversational reply and does not satisfy the frontend's reading-mode eligibility rules
- **THEN** the conversation surface MUST keep that message in the normal plain bubble presentation
- **AND** the workbench MUST NOT force every completed assistant plain-text message into the reading-mode surface

#### Scenario: Streaming assistant text does not switch presentation mid-generation
- **WHEN** an assistant plain-text message is still streaming for the active turn
- **THEN** the conversation surface MUST keep using the existing in-flight text presentation until the message is complete
- **AND** the frontend MUST NOT reflow the message between raw and reading-mode layouts during streaming
