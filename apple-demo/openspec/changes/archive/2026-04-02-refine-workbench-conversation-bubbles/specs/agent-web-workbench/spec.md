## ADDED Requirements

### Requirement: Workbench SHALL collapse intermediate assistant plain-text steps into an expandable process section
The workbench SHALL reduce conversation noise from multi-step assistant plain-text updates by presenting one default-visible main assistant bubble together with an expandable process section for earlier intermediate assistant text messages from the same contiguous assistant-text segment.

#### Scenario: Consecutive assistant text messages collapse into one main bubble
- **WHEN** the conversation history contains two or more consecutive completed assistant plain-text messages within the same contiguous assistant-text segment
- **THEN** the workbench MUST render the last message in that segment as the default-visible main assistant bubble
- **AND** the workbench MUST render the earlier messages from that segment inside a collapsed process section rather than as separate default-visible bubbles

#### Scenario: Single assistant text message stays unchanged
- **WHEN** a contiguous assistant plain-text segment contains only one completed assistant text message
- **THEN** the workbench MUST render that message as a normal assistant bubble
- **AND** the workbench MUST NOT add a process-folding affordance for that single message

#### Scenario: Streaming or structured assistant messages do not reflow into folded history mid-turn
- **WHEN** the active turn is still streaming or the conversation contains assistant `protocol`, `result`, or `error` messages
- **THEN** the workbench MUST keep those in-flight or structured messages on their existing dedicated render paths
- **AND** the frontend MUST only apply the process-folding presentation to completed assistant plain-text history segments

### Requirement: Workbench SHALL rewrite resolved question continuation history into user-readable answer summaries
The workbench SHALL rewrite resolved Question Tool continuation messages into user-readable history bubbles so that users see the submitted answer content or rejection outcome instead of raw `[INTERACTION CONTEXT]` payload text, internal identifiers, or answer JSON.

#### Scenario: Answered question history shows concrete selected or entered values
- **WHEN** the frontend loads a resolved question continuation message together with its answered interaction metadata
- **THEN** the history bubble MUST show a readable answer summary using the interaction field labels
- **AND** any `select` answer MUST display the chosen option label rather than an internal option value
- **AND** any free-text field or `notes` field MUST display the actual user-entered text

#### Scenario: Rejected question history does not expose raw interaction context
- **WHEN** the frontend loads a resolved question continuation message whose interaction status is `rejected`
- **THEN** the history bubble MUST present an explicit user-readable rejection summary
- **AND** the bubble MUST NOT display raw `[INTERACTION CONTEXT]`, `interaction_id`, `question_id`, or serialized answer payload text

#### Scenario: Reload restores the same question summary presentation
- **WHEN** the user reloads or reopens a session that already contains resolved question continuation history
- **THEN** the workbench MUST rebuild the same readable question summary presentation from persisted history plus resolved interaction metadata
- **AND** the frontend MUST NOT require a client-only cached summary to preserve that rendering
