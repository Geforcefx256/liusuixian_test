## Requirements
### Requirement: Agent loop SHALL mark intermediate assistant messages with intermediate attributes
The agent loop SHALL attach `intermediate` attributes to assistant messages saved during tool-call continuation steps (the `continue` path in the loop), so that downstream view and rendering layers can distinguish them from final assistant responses.

#### Scenario: Intermediate message receives intermediate attributes with tool display names
- **WHEN** the agent loop saves an assistant message that contains tool parts and the loop continues to the next iteration
- **THEN** the saved message MUST have `attributes.visibility` set to `'internal'`
- **AND** the saved message MUST have `attributes.semantic` set to `'intermediate'`
- **AND** the saved message MUST have `attributes.toolDisplayNames` set to an array of resolved display names for each tool part in the message, using the active `displayNameResolver` at write time

#### Scenario: Final assistant message does not receive intermediate attributes
- **WHEN** the agent loop saves an assistant message because the LLM returned no tool calls (exit path)
- **THEN** the saved message MUST NOT have `intermediate` attributes

#### Scenario: ShortCircuit assistant message does not receive intermediate attributes
- **WHEN** the agent loop saves an assistant message via the shortCircuit path
- **THEN** the saved message MUST NOT have `intermediate` attributes

### Requirement: Intermediate attributes SHALL use visibility 'internal' to preserve LLM conversation history
The intermediate message attributes SHALL use `visibility: 'internal'` rather than `'hidden'`, ensuring that `isHiddenSessionMessage` does not match and `listMessages` continues to return the full message with all parts intact for LLM context.

#### Scenario: listMessages returns intermediate messages with full parts
- **WHEN** the session store `listMessages` is called for a session containing intermediate-marked assistant messages
- **THEN** the returned messages MUST include those intermediate messages with all original text and tool parts preserved
- **AND** `isHiddenSessionMessage` MUST return `false` for intermediate messages

### Requirement: Attributes parser SHALL support intermediate message attributes
The `parseMessageAttributes` function SHALL recognize and parse `intermediate` attributes in addition to the existing `skill-context` format.

#### Scenario: Intermediate attributes round-trip through serialization
- **WHEN** a message with `{ visibility: 'internal', semantic: 'intermediate', toolDisplayNames: ['读取工作区文件', '查看工作区目录'] }` is saved and then loaded
- **THEN** `parseMessageAttributes` MUST return the same attributes structure with the correct `toolDisplayNames` array

#### Scenario: Invalid toolDisplayNames are filtered during parsing
- **WHEN** the persisted `toolDisplayNames` contains non-string entries
- **THEN** `parseMessageAttributes` MUST filter them out, returning only valid string entries

### Requirement: Message view SHALL return tool-step kind for intermediate messages
The `buildMessageView` function SHALL return `kind: 'tool-step'` for intermediate messages, carrying the `toolDisplayNames` array from attributes and setting `text` to an empty string.

#### Scenario: Intermediate message produces tool-step view
- **WHEN** `buildMessageView` processes a message with `semantic: 'intermediate'` attributes
- **THEN** the returned view MUST have `kind` set to `'tool-step'`
- **AND** the returned view MUST have `toolDisplayNames` set to the array from the message attributes
- **AND** the returned view MUST have `text` set to an empty string

#### Scenario: Non-intermediate messages are unaffected
- **WHEN** `buildMessageView` processes a message without intermediate attributes
- **THEN** the view MUST be produced using the existing logic (kind `'text'`, `'protocol'`, or `'result'`)

### Requirement: appendAssistantMessage SHALL accept optional attributes
The `AgentLoop.appendAssistantMessage` method SHALL accept an optional `attributes` parameter so that callers can attach message-level metadata without changing the persisted parts.

#### Scenario: Attributes are persisted when provided
- **WHEN** `appendAssistantMessage` is called with an `attributes` option
- **THEN** the saved message MUST include the provided attributes

#### Scenario: No attributes when option is omitted
- **WHEN** `appendAssistantMessage` is called without an `attributes` option
- **THEN** the saved message MUST NOT have an `attributes` field
