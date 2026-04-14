## Why

Question Tool currently pauses the run with a generic assistant bubble such as "Need your input before I can continue." while the actual question content only appears in the pending-question card. This breaks conversation continuity in history views and makes it harder for users to understand, at a glance, what specific information is blocking progress.

The product needs a stable, structured way to turn pending question payloads into concise chat-style assistant summaries without expanding raw options, guessing hidden semantics, or coupling runtime behavior to fragile placeholder-text parsing.

## What Changes

- Replace the fixed awaiting-interaction placeholder summary for Question Tool pauses with a deterministic chat-style summary generated from trusted question interaction payload data.
- Define stable summary-generation rules for single-field, multi-field, and degraded question interactions, including conservative fallback behavior when prompt or field metadata is incomplete.
- Keep the pending-question card as the authoritative structured interaction UI while using the generated summary only for conversation continuity in assistant bubbles and persisted run results.
- Remove runtime/frontend assumptions that detect awaiting-question replay artifacts by matching one fixed placeholder string.
- Preserve the existing question reply / reject flow, interaction payload contract, and structured card rendering while improving the assistant bubble presentation.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: Change how awaiting-question assistant summaries are produced and how replay filtering identifies technical awaiting-interaction artifacts.
- `agent-web-workbench`: Change how pending question pauses appear in assistant bubbles so the conversation shows a readable summary of the blocking question instead of a generic waiting sentence.

## Impact

- Affected backend code in question interaction summary generation, awaiting-interaction result building, and replay-artifact filtering.
- Affected frontend code in workbench assistant bubble presentation and question-related tests.
- No top-level directory changes.
- No new third-party dependencies or dependency-version changes.
