## 1. Backend summary generation

- [x] 1.1 Add a deterministic pending-question summary builder in `apps/agent-backend` that formats single-field, multi-field, degraded, and fallback summaries from trusted interaction payload data.
- [x] 1.2 Wire awaiting-interaction result creation and canonical assistant-message persistence to use the generated question summary instead of the fixed placeholder sentence.
- [x] 1.3 Update awaiting-interaction replay filtering so technical waiting artifacts are identified through structured awaiting-interaction markers rather than exact assistant-text matching.

## 2. Workbench rendering

- [x] 2.1 Keep the pending-question card as the authoritative structured interaction UI while rendering the backend-provided awaiting-question summary in the assistant bubble path.
- [x] 2.2 Preserve the same awaiting-question summary presentation when session history is reloaded from canonical backend messages.

## 3. Verification

- [x] 3.1 Add or update backend tests for single-text, single-select, multi-field, degraded, and conservative-fallback question summaries.
- [x] 3.2 Add or update backend tests that confirm awaiting-interaction replay filtering no longer depends on one fixed placeholder string.
- [x] 3.3 Add or update frontend tests that confirm awaiting-question turns show the readable assistant summary without duplicating option lists or degraded diagnostics into the bubble.
