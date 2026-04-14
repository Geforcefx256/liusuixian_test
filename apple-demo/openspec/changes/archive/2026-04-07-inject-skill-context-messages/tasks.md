## 1. Tool Side Effects And Session Model

- [x] 1.1 Extend gateway tool invoke success types to support typed injected-message side effects for runtime tools.
- [x] 1.2 Add persistent message attributes for hidden runtime-only messages and parse/serialize them in session storage.
- [x] 1.3 Update session message view building so hidden skill-context messages are excluded from the ordinary workbench history response.

## 2. Skill Injection In Main Agent Loop

- [x] 2.1 Change `skill:skill` to return a short visible summary while emitting a hidden injected skill-context message with canonical skill content.
- [x] 2.2 Update the main `agentLoop` tool execution flow to persist both the visible tool trace and any injected hidden skill-context messages in the correct order.
- [x] 2.3 Keep logging concise by recording skill injection metadata and previews without logging full skill bodies.

## 3. Context Retention And Compaction

- [x] 3.1 Replace retained-skill extraction from `skill:skill` tool output scanning with extraction from persisted hidden skill-context messages.
- [x] 3.2 Update context-building and compaction paths so retained skill content remains separate from conversation summaries and is reinjected through the dedicated retained-skill reminder.
- [x] 3.3 Ensure resumed sessions and later turns consume hidden skill-context messages without requiring reparsing of historical tool summary text.

## 4. Verification

- [x] 4.1 Add backend tests covering successful and failed `skill:skill` persistence, hidden-message filtering in session history views, and retention reconstruction from hidden skill-context messages.
- [x] 4.2 Add or update context-manager tests to verify retained-skill reminder behavior still respects summary boundaries and retention budget after the storage model change.
- [x] 4.3 Run the relevant agent-backend test and type-check commands to validate the new skill injection flow end to end.
