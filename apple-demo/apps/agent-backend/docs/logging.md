# Agent Backend Logging Contract

`apps/agent-backend` persists backend-only operational logs as structured JSONL files. The contract is write-time explicit: every persisted entry declares its `category` and `component` directly, and the runtime no longer relies on `console.*` interception or browser dev-log routes.

## Goals

- Keep backend diagnostics inspectable with shell tools.
- Make ownership explicit through `category` and `component`.
- Redact sensitive values before entries reach disk.
- Keep runtime logging independent from any browser log viewer.

## File Layout

Runtime logs are written under:

```text
apps/agent-backend/data/logs/YYYY-MM-DD/<category>.jsonl
```

Current categories:

- `runtime`: entrypoint, route, run lifecycle, runtime error, session, planner, and execution diagnostics.
- `model`: provider request/response and transport diagnostics.
- `tool`: local/skill tool invocation, retry, and tool-failure-policy diagnostics.

## Entry Shape

Each line is one JSON object with these fields:

- `id`: UUID for the log entry.
- `timestamp`: ISO-8601 UTC timestamp.
- `level`: `info`, `warn`, or `error`.
- `category`: closed runtime category name.
- `component`: stable writer identity inside the category.
- `message`: short human-readable summary.
- `userId`, `agentId`, `sessionId`, `runId`, `turnId`: included when that scope exists.
- `data`: optional structured detail payload.

Example:

```json
{
  "id": "7d9d1b5f-2b0d-4d10-8f9f-fbb2d2878f18",
  "timestamp": "2026-03-29T09:19:47.327Z",
  "level": "warn",
  "category": "runtime",
  "component": "runtime_errors",
  "message": "runtime error recorded",
  "userId": 1,
  "agentId": "workspace-agent",
  "sessionId": "session-1",
  "runId": "run-1",
  "turnId": "session-1:turn-1",
  "data": {
    "code": "MODEL",
    "stage": "model",
    "userMessage": "Missing model configuration"
  }
}
```

## Redaction Rules

The logger redacts sensitive values before file writes. The redaction pass applies to both `message` and nested `data` values.

Sensitive keys:

- `apiKey`
- `authorization`
- `proxy-authorization`
- `token`
- `x-token`
- `secret`
- `password`
- `set-cookie`

Rules:

- Matching object keys are replaced with `[REDACTED]`.
- Matching inline `key: value` text patterns inside message strings are replaced with `[REDACTED]`.
- Tool write payload bodies must not be logged directly; only metadata may be persisted.

## Component Guidance

Component names are stable identifiers, not free-form prefixes. Current examples:

- `entrypoint`
- `agent_route`
- `run.lifecycle`
- `run.metrics`
- `run.result`
- `run_timing`
- `runtime_errors`
- `provider_client`
- `local_provider`
- `skill_provider`
- `agent_loop`
- `planner_loop`
- `session_store`

When adding a new writer:

1. Reuse an existing category if it matches the operational concern.
2. Add a short, stable `component`.
3. Keep `message` concise and move structured detail into `data`.

## Shell Usage

Tail one category:

```bash
tail -f apps/agent-backend/data/logs/$(date +%F)/runtime.jsonl
```

Tail model diagnostics:

```bash
tail -f apps/agent-backend/data/logs/$(date +%F)/model.jsonl
```

Filter by run:

```bash
rg '"runId":"run-123"' apps/agent-backend/data/logs/$(date +%F)/*.jsonl
```

## Legacy Migration Notes

Legacy behavior removed by this contract:

- `console.*` persistence through the old console bridge
- in-memory dev-log snapshot/query/subscribe storage
- `/agent/api/agent/dev-logs/snapshot`
- `/agent/api/agent/dev-logs/stream`
- single-file `agent-backend-YYYY-MM-DD.jsonl` runtime layout

Persisted runtime diagnostics must now go through the structured logger.
