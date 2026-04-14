## 1. Extract Retained Skills From Session History

- [x] 1.1 Add a retained-skill extraction helper under `apps/agent-backend/src/agent/context/` that scans persisted session messages for successful `skill:skill` results.
- [x] 1.2 Keep only the latest successful retained content per skill name and ignore listing/discovery-only signals plus failed `skill:skill` calls.
- [x] 1.3 Add extraction diagnostics that log reconstructed skill names and skip reasons when no retained skills are found.

## 2. Inject Retained Skills Into Compacted Context

- [x] 2.1 Extend `ContextManager` message-pool construction so compacted sessions can prepend one dedicated retained-skill reminder message after the summary message.
- [x] 2.2 Add a dedicated retention budget for the reminder message and skip overflowed retained skills instead of merging them into the summary text.
- [x] 2.3 Emit retention injection and budget-skip logs with session scope, selected skill names, and injected size details.

## 3. Verify Behavior And Boundaries

- [x] 3.1 Add unit tests for retained-skill extraction from persisted session messages, including latest-wins and failed-call exclusion cases.
- [x] 3.2 Add context-building tests that verify compacted sessions inject the retained-skill reminder while non-compacted sessions do not.
- [x] 3.3 Add tests or assertions that confirm retention stays separate from generic summary text and does not include listing/discovery messages.
