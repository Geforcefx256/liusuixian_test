## Why

`apps/agent-backend` currently mixes runtime timeline events and intercepted `console.*` output into a single daily JSONL file, which makes operational troubleshooting noisy and forces log consumers to infer module ownership from message prefixes. The backend also still carries dev-log snapshot/stream routes and in-memory subscription machinery that are not consumed by the current product, so this is a good point to simplify the logging surface before more modules depend on it.

## What Changes

- Replace the current devlog persistence model with a backend-only structured file logger that records explicit log categories and components at write time instead of relying on `console bridge` interception.
- Split runtime log files by date and log category so operators can inspect focused files with shell tools such as `tail -f`.
- Remove the browser-facing dev-log snapshot/stream routes and the in-memory query/subscribe store behavior that only existed to support those routes.
- Add a maintained logging contract document at `apps/agent-backend/docs/logging.md` covering categories, fields, redaction rules, file layout, and migration guidance from legacy `console.*` call sites.
- If `apps/agent-backend/config.json` needs updates for this change, limit them strictly to logging-related settings; auth, model, tool, sandbox, workspace, and other unrelated configuration keys are out of scope.
- **BREAKING**: Remove `/agent/api/agent/dev-logs/*` runtime endpoints and the legacy single-file devlog layout.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: runtime logging changes from devlog route-backed daily files to backend-only structured category files, and the runtime no longer exposes dev-log HTTP routes.

## Impact

- Affected code: `apps/agent-backend/src/devlogs/**`, `apps/agent-backend/src/index.ts`, runtime modules that currently call `console.*`, and new logging documentation under `apps/agent-backend/docs/`.
- Affected config scope: `apps/agent-backend/config.json` logging-related settings only; unrelated runtime configuration stays unchanged in this change.
- Affected APIs: removal of `/agent/api/agent/dev-logs/snapshot` and `/agent/api/agent/dev-logs/stream`.
- Operational impact: file consumers move from one daily JSONL file to per-category daily JSONL files intended for direct shell inspection.
