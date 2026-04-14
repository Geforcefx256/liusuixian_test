## MODIFIED Requirements

### Requirement: Workbench SHALL collapse intermediate assistant plain-text steps into an expandable process section
The workbench SHALL reduce conversation noise from multi-step assistant updates by presenting one default-visible main assistant bubble together with an expandable process section. The process section SHALL accept both plain-text and tool-step message types. For tool-step messages, the section SHALL render each tool's display name as a separate line item instead of showing LLM-generated text.

#### Scenario: Consecutive assistant text and tool-step messages collapse into one main bubble
- **WHEN** the conversation history contains two or more consecutive completed assistant messages (plain-text or tool-step) within the same contiguous assistant segment
- **THEN** the workbench MUST render the last plain-text message in that segment as the default-visible main assistant bubble
- **AND** the workbench MUST render the earlier messages from that segment inside a collapsed process section rather than as separate default-visible bubbles

#### Scenario: Single assistant text message stays unchanged
- **WHEN** a contiguous assistant segment contains only one completed assistant text message
- **THEN** the workbench MUST render that message as a normal assistant bubble
- **AND** the workbench MUST NOT add a process-folding affordance for that single message

#### Scenario: Streaming or structured assistant messages do not reflow into folded history mid-turn
- **WHEN** the active turn is still streaming or the conversation contains assistant `protocol`, `result`, or `error` messages
- **THEN** the workbench MUST keep those in-flight or structured messages on their existing dedicated render paths
- **AND** the frontend MUST only apply the process-folding presentation to completed assistant history segments

#### Scenario: Tool-step messages in collapsed section render per-tool display names
- **WHEN** a collapsed process section contains a tool-step message with `toolDisplayNames` array
- **THEN** the workbench MUST render each display name as a separate line item within that step's container
- **AND** the workbench MUST NOT render any LLM-generated text for that tool-step message

#### Scenario: Tool-step message with multiple tools renders all tools as separate lines
- **WHEN** a single tool-step message has `toolDisplayNames` containing multiple entries (e.g., `['读取工作区文件', '查看工作区目录']`)
- **THEN** the workbench MUST render each entry as its own line within the same step container
- **AND** the lines MUST appear in the same order as the `toolDisplayNames` array

#### Scenario: Pure tool-step segment without trailing text forms a tool-step group
- **WHEN** a contiguous assistant segment consists entirely of completed `tool-step` messages with no trailing plain-text message
- **THEN** the workbench MUST merge those tool-step messages into a single tool-step group display item
- **AND** the workbench MUST render each tool's display name as a line item within the group
- **AND** the workbench MUST NOT render empty bubbles for those tool-step messages

#### Scenario: Standalone tool-step message renders tool names instead of empty bubble
- **WHEN** a single `tool-step` message is rendered as an independent display item (not part of any group)
- **THEN** the workbench MUST render the tool display names from `toolDisplayNames` as line items
- **AND** the workbench MUST NOT render an empty bubble with no visible content

#### Scenario: Mixed segment ending with tool-step renders tool-step with visible content
- **WHEN** a contiguous assistant segment contains both plain-text and tool-step messages but ends with a tool-step message
- **THEN** the workbench MUST render each message as an independent display item
- **AND** each tool-step message MUST render its `toolDisplayNames` as visible line items instead of an empty bubble
