## Context

The prior ownership move already made `apps/web-backend` the canonical MML rule owner and introduced `/web/api/mml/schema`, but it deliberately left the workbench on a temporary compatibility path through `apps/agent-backend`. Today the browser still asks `agent-backend` for MML schema, `agent-backend` forwards that request to `web-backend`, and the frontend receives an agent-shaped payload even though the canonical schema contract already lives elsewhere.

That leaves the system in an awkward intermediate state:

- the frontend is still coupled to the wrong backend namespace for MML rule lookup
- `agent-backend` still carries compatibility-only routing, proxy logic, tests, and docs for a responsibility it no longer owns
- local reasoning about route ownership is harder because product MML schema reads still appear under `/agent/api/*`

This follow-up is narrow in product surface but cross-cutting in implementation because it touches frontend API wiring, workbench tests, agent-backend route cleanup, and service documentation together.

## Goals / Non-Goals

**Goals:**
- Move frontend MML schema reads onto the canonical `/web/api/mml/schema` route.
- Preserve current workbench behavior for MML text assistance and workbook table projection.
- Delete the `agent-backend` compatibility proxy and its supporting code once the frontend no longer depends on it.
- Make route ownership obvious: browser reads for MML schema should terminate at the canonical service.

**Non-Goals:**
- Changing the schema payload semantics returned by `web-backend`.
- Reworking unrelated `/agent/api/files/*` routes.
- Reopening the earlier owner migration or moving more rule-management behavior between services.
- Introducing a shared cross-package schema DTO package in this phase.

## Decisions

### Decision: Frontend cutover uses a dedicated web-side MML schema API module

The frontend will stop sourcing MML schema through `agentApi` and will instead introduce a dedicated API path under the `web-backend` client layer using `getWebApiBase()` and the standard `{ success, data }` response shape.

Rationale:
- `agentApi` currently encodes the agent-backend response contract and URL namespace, which no longer matches the canonical owner for MML schema.
- existing frontend modules such as `authApi` and `userAdminApi` already establish the correct web-backend fetch pattern and credential handling
- a dedicated module keeps the route cutover explicit instead of leaving a misleading MML exception inside `agentApi`

Alternatives considered:
- Keep `getMmlSchema()` inside `agentApi` and only change its URL.
- Add a generic mixed-backend API helper for both agent and web routes.

Why not:
- leaving the method in `agentApi` would keep the ownership boundary misleading even after the route is changed
- a mixed abstraction adds indirection without solving a real problem in this small migration

### Decision: Delete the compatibility proxy in the same change as the frontend cutover

Once the browser no longer calls `/agent/api/files/mml-schema`, the compatibility route, proxy client, and proxy tests in `agent-backend` will be removed immediately rather than left dormant.

Rationale:
- the real frontend call site is narrow, so staged coexistence buys little after the cutover
- removing the compatibility code prevents future drift and reduces false ownership signals in the agent runtime
- deleting the proxy with the cutover avoids carrying dual route contracts that must be tested and documented

Alternatives considered:
- keep the proxy indefinitely as an unused fallback
- ship the frontend cutover first and remove the proxy in a later cleanup change

Why not:
- an unused fallback quickly becomes dead code with unclear support status
- splitting the cleanup into yet another phase increases cost without reducing meaningful rollout risk

### Decision: Preserve frontend behavior by adapting only the transport layer

The workbench will keep the same schema-loading state machine and downstream schema consumers. The migration changes only how schema is fetched and decoded, not how `WorkspaceEditorPane`, Monaco assistance, or workbook projection reason about loaded schema.

Rationale:
- current product behavior is already correct enough for text/table schema consumption
- the transport-layer change is small and testable, while broader behavior refactors would widen scope unnecessarily
- preserving the existing state machine keeps regressions localized to route wiring and payload decoding

Alternatives considered:
- refactor schema loading and view gating at the same time as the route cutover
- move schema fetch responsibility deeper into individual MML editor components

Why not:
- bundling behavior refactors with the route cutover would make failures harder to isolate
- pushing fetch logic down into child components would duplicate loading concerns and complicate tests

## Risks / Trade-offs

- [Frontend tests are tightly coupled to `agentApi.getMmlSchema`] → Update mocks and assertions in one pass so the route cutover does not leave stale test doubles behind.
- [Deleting the proxy removes a fallback path for older browser bundles] → This is acceptable because the product is same-repo and same-deploy; the frontend and backend are shipped together in this workflow.
- [Developers may still look for MML schema ownership in archived agent-backend docs or older specs] → Update current README and new OpenSpec artifacts so the active route contract is unambiguous.
- [The canonical web route uses a different envelope shape from the old agent route] → Keep the translation isolated in the new frontend API module and leave downstream consumers unchanged.

## Migration Plan

1. Add a dedicated frontend web API helper for MML schema lookup and switch `WorkspaceEditorPane` to use it.
2. Update frontend tests to mock the new web API module instead of `agentApi.getMmlSchema`.
3. Remove the `/agent/api/files/mml-schema` route, proxy client, and related tests from `agent-backend`.
4. Clean up README and change artifacts that still describe the proxy as part of the supported runtime surface.
5. Verify that authenticated workbench flows still load schema and that missing-schema cases still degrade cleanly.

Rollback strategy:
- restore the deleted `agent-backend` proxy route and switch the frontend call back to the previous `agentApi` path
- because schema payload semantics stay unchanged for downstream consumers, rollback is route-local rather than a broader behavioral rollback

## Open Questions

- None for the selected scope. The route owner, canonical endpoint, and cleanup direction are already decided by the previous migration phase.
