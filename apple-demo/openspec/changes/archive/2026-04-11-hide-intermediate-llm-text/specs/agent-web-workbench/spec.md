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

#### Scenario: Segment ending with tool-step does not form a process group
- **WHEN** a contiguous assistant segment ends with a tool-step message rather than a plain-text message
- **THEN** the workbench MUST NOT create a process group for that segment
- **AND** the workbench MUST render each message in the segment as an independent display item
