## Context

`apps/agent-backend` currently persists runtime logs through the `devlogs` subsystem. That subsystem mixes timeline events and intercepted `console.*` output into one daily JSONL file, keeps an in-memory query/subscribe buffer for `/agent/api/agent/dev-logs/*`, and depends on message prefixes to infer module ownership for many persisted entries. The current frontend does not consume those dev-log routes, while backend debugging needs focused file inspection and a stable logging contract that can be tailed directly from disk.

The change is cross-cutting because it touches runtime entrypoint wiring, the devlogs package, multiple runtime modules that currently emit `console.*`, and operator-facing documentation. It also changes persisted file layout and removes HTTP endpoints, so the design needs to make migration and scope boundaries explicit before implementation.

## Goals / Non-Goals

**Goals:**
- Replace implicit console-interception logging with an explicit structured logger owned by `apps/agent-backend`.
- Persist logs into per-day, per-category JSONL files that support direct shell inspection.
- Remove unused dev-log snapshot/stream HTTP routes and the in-memory query/subscribe machinery behind them.
- Define and document a stable logging contract, including categories, required fields, and redaction expectations.
- Migrate existing high-value runtime logging call sites from raw `console.*` to the new logger without introducing silent fallback behavior.
- Keep `apps/agent-backend/config.json` changes, if any, strictly limited to logging-related settings.

**Non-Goals:**
- Adding a frontend log viewer, log search UI, or browser log streaming surface.
- Introducing a third-party logging framework during this change.
- Reworking non-runtime document stores such as memory daily logs.
- Revisiting unrelated `apps/agent-backend/config.json` settings outside runtime logging.
- Solving long-term retention, compression, or external shipping to log aggregation systems.

## Decisions

### 1. Build a thin in-repo logger instead of adopting `pino` or `winston`

The runtime needs explicit `category` and `component` fields, direct control over JSONL layout, and predictable redaction before disk writes. A small in-repo logger keeps the contract local, avoids transport-heavy abstraction, and lets the team evolve categories and sink behavior without binding to a third-party framework.

Alternatives considered:
- `pino`: strong JSON support, but category-based file routing would still require custom transport/sink work and extra operational conventions.
- `winston`: flexible transports, but heavier than needed for a backend-only file logging surface.

### 2. Replace the current devlog store with a write-focused dispatcher

The existing `DevLogStore` currently does three jobs: bounded in-memory retention, subscriber fan-out, and sink dispatch. After removing the dev-log HTTP routes, only sink dispatch remains valuable. The runtime should retain a minimal append/close abstraction for sinks and drop query/subscribe state entirely.

Alternatives considered:
- Keep the in-memory store “just in case”: rejected because it preserves unused complexity and makes the runtime appear to support interactive log viewing when it no longer does.
- Remove the dispatcher entirely and let modules write files directly: rejected because it would scatter redaction and file-routing logic across modules.

### 3. Persist logs by `date + category`, with category chosen at write time

Each persisted entry will carry explicit `category` and `component` fields. The file sink will route entries to a path shaped like `data/logs/YYYY-MM-DD/<category>.jsonl`. This keeps category ownership stable, makes `tail -f` practical, and avoids inferring module identity from free-form message prefixes.

Alternatives considered:
- Keep a single daily file and rely on structured filters later: rejected because the main operator complaint is file-level noise.
- Route by component rather than category: rejected because it would create too many files and weaken coarse operational grouping.

### 4. Remove `console bridge` entirely and migrate persisted logging call sites to explicit logger usage

Once the backend stops serving dev-log routes and stops using a single legacy file, keeping console interception would only preserve ambiguous ownership and hidden coupling to stdout/stderr. Modules that currently produce persisted runtime diagnostics through `console.*` should instead log through explicit category-aware logger instances. Plain process stdout/stderr can remain for non-persisted process output only where intentionally chosen.

Alternatives considered:
- Keep the bridge as a temporary compatibility path: rejected because it would prolong ambiguous message-prefix routing and partially defeat the “explicit category at write time” goal.

### 5. Treat logging documentation as part of the contract, not an afterthought

`apps/agent-backend/docs/logging.md` will define the supported categories, required fields, redaction rules, file layout, and migration mapping from legacy `console.*` usage. This document becomes the reference for future runtime modules and for operators tailing files directly.

Alternatives considered:
- Document only in code comments: rejected because operators and future contributors need one stable operational reference.

### 6. Keep `config.json` scope narrow and logging-only

If the implementation needs to touch `apps/agent-backend/config.json`, it should only add, remove, or reinterpret keys that directly control runtime logging. This avoids bundling unrelated config churn into an operational logging migration and keeps rollout risk focused on one subsystem.

Alternatives considered:
- Fold adjacent runtime config cleanup into the same change: rejected because it would blur rollback boundaries and make it harder to attribute behavior changes to logging work alone.

## Risks / Trade-offs

- [Migration breadth across many `console.*` call sites] → Start with runtime-critical modules (`providerClient`, tool providers, run/session services, entrypoint/storage) and map each call site to an explicit category/component in the tasks list.
- [Breaking existing tooling that expects `/agent/api/agent/dev-logs/*`] → Remove the routes explicitly in the spec and document the replacement operational path as file-based shell inspection.
- [Category sprawl or inconsistent naming] → Define a closed initial category set in `logging.md` and require new modules to use documented categories before adding more.
- [Sensitive payloads reaching disk through newly structured fields] → Preserve centralized redaction in the logger pipeline and document forbidden/raw payload patterns in `logging.md`.
- [Operators losing a single combined view] → Preserve same-day filesystem locality so combined inspection remains possible with shell tools, while category files provide the default focused path.
- [Unrelated `config.json` drift sneaks into the rollout] → Treat non-logging config edits as out of scope and reject them from this change.

## Migration Plan

1. Introduce the new logger types, context helpers, dispatcher, redaction, and category-aware file sink behind the existing runtime startup path.
2. Add `logging.md` with the supported contract and category dictionary before converting broad call sites.
3. Convert timeline logging and selected runtime modules from `console.*` to explicit logger calls, ensuring persisted entries always carry `category` and `component`.
4. If config changes are required during migration, keep them limited to documented runtime logging settings in `apps/agent-backend/config.json`.
5. Remove `consoleBridge`, dev-log HTTP routes, and in-memory query/subscribe behavior once no persisted logging path depends on them.
6. Verify the runtime writes the new file layout and no longer exposes `/agent/api/agent/dev-logs/*`.
7. Leave rollback as code rollback to the prior runtime package revision; no data migration is required because log files are append-only operational artifacts.

## Open Questions

- Whether startup/shutdown banner messages should be persisted through the structured logger or remain stdout-only process messages.
- Whether any low-value legacy `console.*` diagnostics should be dropped entirely instead of migrated into structured files.
