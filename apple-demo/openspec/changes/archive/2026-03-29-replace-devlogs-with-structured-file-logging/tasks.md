## 1. Logging Contract

- [x] 1.1 Add `apps/agent-backend/docs/logging.md` defining the backend-only logging goals, category dictionary, required fields, redaction rules, file layout, and `tail -f` usage.
- [x] 1.2 Define the new logging types and context contract so persisted entries carry explicit `category`, `component`, level, message, and runtime identifiers.
- [x] 1.3 Keep any `apps/agent-backend/config.json` edits limited to runtime logging settings and leave unrelated configuration untouched.

## 2. Core Logger Pipeline

- [x] 2.1 Replace the current devlog store with a write-focused dispatcher that only fans out to sinks and closes them during shutdown.
- [x] 2.2 Implement a category-aware daily JSONL file sink that writes to `apps/agent-backend/data/logs/<YYYY-MM-DD>/<category>.jsonl`.
- [x] 2.3 Preserve centralized redaction in the new logger pipeline so persisted entries are sanitized before disk writes.

## 3. Runtime Logging Migration

- [x] 3.1 Convert timeline logging to the new structured logger with explicit runtime categories/components instead of legacy devlog entry construction.
- [x] 3.2 Migrate runtime-critical `console.*` call sites in entrypoint, run/session services, provider client, tool providers, and storage/runtime support modules to explicit logger usage.
- [x] 3.3 Standardize the initial category mapping for migrated modules and remove reliance on message-prefix ownership such as `[LLM]`, `[AgentLoop]`, and `[local_tool]`.

## 4. Legacy Surface Removal And Verification

- [x] 4.1 Remove `consoleBridge`, dev-log snapshot/stream routes, and the related route wiring from the runtime entrypoint.
- [x] 4.2 Remove unused in-memory dev-log query/subscribe types, tests, and exports that only served the deleted HTTP routes.
- [x] 4.3 Update and add automated tests to cover category-based file output, logger redaction, and the absence of legacy dev-log route behavior.
