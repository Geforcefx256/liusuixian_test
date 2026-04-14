## Context

`apps/agent-backend` now treats workspace files canonically as `upload` and `project`, but existing deployments may still contain `uploads/`, `outputs/`, legacy `file-map.json` entries, and serialized session metadata that references `input`, `working`, or `output`. The user explicitly accepted a breaking upgrade that removes those legacy artifacts instead of preserving compatibility.

The implementation must keep failures explicit. The runtime should not silently reinterpret legacy state, and it should not start in a half-broken mode where old data remains present but inaccessible.

## Goals / Non-Goals

**Goals:**
- Provide one explicit cleanup path that removes legacy workspace naming data before runtime startup.
- Refuse backend startup when legacy workspace naming artifacts are still present.
- Keep repository-owned manifests, fixtures, and tests aligned with the canonical `upload/project` naming.
- Document the upgrade as a breaking change with explicit data-loss expectations.

**Non-Goals:**
- No compatibility layer for legacy `input/working/output(s)` workspace data.
- No migration of legacy workspace files into new canonical locations.
- No support for legacy `uploadsDir` / `outputsDir` path-base aliases at runtime.

## Decisions

### 1. Add a dedicated cleanup script instead of embedding destructive cleanup into normal startup

Startup should stay deterministic and fail loudly when legacy state exists. A separate script makes the destructive operation explicit, reviewable, and runnable ahead of deployment.

Alternative considered:
- Auto-delete legacy artifacts during startup.
  Rejected because it hides destructive behavior inside normal boot and makes rollback/debugging harder.

### 2. Detect legacy state from both filesystem roots and persisted session metadata

Only checking `uploads/` and `outputs/` directories is insufficient because sessions can still carry stale workspace references even after directories are removed. Startup gating therefore needs one detector over workspace storage and one detector over session metadata persistence.

Alternative considered:
- Gate only on filesystem roots.
  Rejected because it still allows stale session metadata to load into a broken state.

### 3. Cleanup removes legacy workspace metadata instead of translating it

The accepted product decision is to drop compatibility. Cleanup should therefore delete legacy workspace roots and strip legacy workspace file references from persisted sessions rather than attempting to reinterpret or migrate them.

Alternative considered:
- Translate legacy entries in place.
  Rejected because it reintroduces compatibility behavior the user explicitly declined.

### 4. Repository-owned fixtures must be canonical before startup gating lands

Once startup and manifest validation reject legacy naming, repository-owned tests and manifest fixtures must stop using legacy identifiers; otherwise the tree becomes self-inconsistent.

## Risks / Trade-offs

- [Historical workspace data is lost] → Mitigation: document the cleanup command and breaking behavior clearly in `README.md`.
- [Operators forget to run cleanup before restart] → Mitigation: startup fails with an explicit action-oriented error instead of serving partial behavior.
- [Cleanup misses one legacy persistence location] → Mitigation: add targeted tests for filesystem detection, session metadata cleanup, and manifest fixture updates.

## Migration Plan

1. Stop `apps/agent-backend`.
2. Run the dedicated legacy workspace cleanup script.
3. Start `apps/agent-backend`; startup continues only if no legacy naming artifacts remain.
4. Rollback, if needed, requires restoring the pre-cleanup workspace/session data from backup because cleanup is destructive.

## Open Questions

- None.
