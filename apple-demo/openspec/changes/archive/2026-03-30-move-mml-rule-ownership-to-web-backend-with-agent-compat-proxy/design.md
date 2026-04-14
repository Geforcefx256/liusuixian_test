## Context

The current Excel-backed MML rule engine was added under `apps/agent-backend`, where startup imports fixed workbooks into a local rule database and `/agent/api/files/mml-schema` serves the normalized schema used by the workbench. That implementation works functionally, but the ownership is misplaced: MML rules are product rule-catalog data, not agent-runtime state.

The user-selected direction for this change is a phased ownership correction:

- `web-backend` becomes the only owner of MML rule import, rule storage, and canonical schema lookup.
- `agent-backend` keeps the existing `/agent/api/files/mml-schema` browser route only as a compatibility layer for the current frontend.
- the frontend does not switch routes in this phase.

This is a cross-service change because startup bootstrap, storage, routing, auth propagation, tests, and documentation all move across service boundaries while the browser-facing contract remains stable.

## Goals / Non-Goals

**Goals:**
- Establish `apps/web-backend` as the single owner of imported MML rule catalogs.
- Preserve one authoritative bootstrap path, one active rule database, and one canonical schema assembly flow.
- Add a canonical authenticated route at `/web/api/mml/schema`.
- Keep the current frontend contract working through `/agent/api/files/mml-schema` without requiring immediate frontend changes.
- Reuse existing browser auth context so the compatibility proxy does not need a new service token scheme.

**Non-Goals:**
- Moving the frontend to `/web/api/mml/schema` in this change.
- Migrating unrelated `/agent/api/files/*` endpoints to `web-backend`.
- Introducing dual ownership, dual databases, or dual startup bootstrap for MML rules.
- Extracting a shared cross-package DTO library for MML schema types in this phase.
- Performing a broader config taxonomy cleanup beyond what is necessary to ship the ownership move.

## Decisions

### Decision: `web-backend` becomes the canonical MML rule owner

`apps/web-backend` will own the Excel workbook import pipeline, the active rule database, and schema assembly for `networkType + networkVersion`.

Rationale:
- MML rules are product-owned domain data, which fits the web/backend product service boundary better than the agent runtime.
- this removes a responsibility mismatch from `agent-backend`
- it prevents long-term drift from having multiple services act like rule owners
- future rule management and backend integration can build on one canonical surface

Alternatives considered:
- keep ownership in `agent-backend`
- split ownership between both backends

Why not:
- keeping ownership in `agent-backend` preserves the current architectural mismatch
- dual ownership would create duplicated bootstrap, duplicated storage, and eventual schema drift

### Decision: Canonical schema route is `/web/api/mml/schema`

`web-backend` will expose the canonical schema lookup route at `/web/api/mml/schema`, protected by the existing authenticated web-backend middleware.

Rationale:
- the route belongs with the canonical owner
- it fits naturally under the existing `/web/api/*` namespace
- it gives internal and future external consumers one stable route to target

Alternatives considered:
- keep `/agent/api/files/mml-schema` as the canonical route permanently
- add a second internal-only route outside the web API surface

Why not:
- leaving the canonical contract under `agent-backend` would hide the true owner behind a compatibility path
- an internal-only route would add special-case infrastructure without a product need in this phase

### Decision: `agent-backend` keeps `/agent/api/files/mml-schema` only as a compatibility proxy

The browser-facing route used by the current frontend will remain available, but `agent-backend` will stop owning local rule storage and instead proxy schema lookup to `web-backend`.

Rationale:
- current frontend code can remain unchanged
- ownership still moves cleanly to `web-backend`
- the compatibility layer stays narrow and reversible

Alternatives considered:
- direct frontend cutover to `/web/api/mml/schema` in the same change
- keeping the old local agent-owned route implementation

Why not:
- a direct cutover expands scope into frontend migration and rollout coordination
- keeping local ownership defeats the purpose of the change

### Decision: Proxy auth uses the existing browser session context

The compatibility proxy will forward the browser auth context, especially the `Cookie` header, to `web-backend` so the canonical route can keep using `requireAuth`. This change does not introduce a new internal service token.

Rationale:
- the browser already authenticates against `web-backend`
- forwarding the current session context is simpler than creating new service credentials
- it preserves existing auth semantics for the schema route

Alternatives considered:
- anonymous internal schema route
- dedicated internal service token between `agent-backend` and `web-backend`

Why not:
- anonymous access would weaken the current web-backend auth boundary
- a new service token path adds avoidable security and operational scope

### Decision: Keep config cleanup minimal and explicit

If the compatibility proxy temporarily reuses the existing configured web-backend base URL path currently used for auth lookup, that reuse is acceptable for this change as long as the ownership move itself is completed cleanly. Naming cleanup such as a dedicated `webBackend.baseUrl` is treated as follow-up work unless it becomes necessary for implementation clarity.

Rationale:
- the primary goal is ownership correction, not config refactoring
- keeping this phase narrow reduces migration risk

Alternatives considered:
- require full config renaming as part of this change

Why not:
- that increases scope without materially improving the ownership outcome for this phase

## Risks / Trade-offs

- [Compatibility proxy adds an extra hop] → Keep the proxy thin, preserve the existing payload shape, and cover error mapping with tests.
- [Developers may assume `agent-backend` still owns MML rules because the old route remains] → Make `web-backend` the only bootstrap/storage owner and update specs/docs to name `agent-backend` as compatibility-only.
- [Temporary reuse of an auth-oriented base URL setting can be semantically awkward] → Document it as transitional and defer broader naming cleanup unless implementation forces an immediate change.
- [Cross-service migration can regress startup or packaging behavior] → Move bootstrap and dependency ownership together and add service-local tests for import, route auth, and proxy behavior.

## Migration Plan

1. Add MML rule config, import/bootstrap wiring, and the canonical schema route to `web-backend`.
2. Move the Excel-backed rule modules and related tests so `web-backend` owns the active ruleset lifecycle end to end.
3. Replace `agent-backend` local MML rule bootstrap/store wiring with a thin client/proxy to `/web/api/mml/schema`.
4. Keep the existing frontend on `/agent/api/files/mml-schema` and verify behavior remains unchanged from the browser's perspective.
5. Update service docs and specs so future work targets `web-backend` as the canonical rule owner.

Rollback strategy:
- restore the previous agent-owned implementation and remove the proxy if the migration must be reversed before follow-up frontend work begins
- because the frontend contract stays stable in this phase, rollback does not require a frontend route rollback

## Open Questions

- None for this proposal scope. The selected phase is to correct service ownership first while keeping the current frontend contract stable.
