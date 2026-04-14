## Why

The previous MML rule ownership migration intentionally stopped at a compatibility phase: `web-backend` became the canonical owner, but the workbench still loads schema through `agent-backend`'s `/agent/api/files/mml-schema` proxy. Keeping that extra hop after ownership has already moved leaves the frontend pointed at the wrong service boundary, preserves dead compatibility code in `agent-backend`, and makes future MML route cleanup harder.

## What Changes

- Move the workbench MML schema lookup from `/agent/api/files/mml-schema` to the canonical `/web/api/mml/schema` route.
- Add a dedicated web-side frontend API path for MML schema lookup that follows the existing `web-backend` response contract and auth model.
- Remove `agent-backend`'s `/agent/api/files/mml-schema` compatibility route and its proxy client implementation.
- Delete compatibility-only tests and documentation that still describe `agent-backend` as an MML schema facade.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: the workbench changes its MML schema source from the agent proxy route to the canonical web route while preserving table and text behavior.
- `agent-backend-runtime`: the runtime no longer exposes or documents `/agent/api/files/mml-schema` as a browser-facing compatibility route.

## Impact

- `apps/web/src/components/workbench/WorkspaceEditorPane.vue` and related frontend API/test files switch MML schema loading onto `web-backend`.
- `apps/agent-backend/src/routes/files.ts`, proxy-specific client code, tests, and README content lose the MML schema compatibility surface.
- Browser traffic for MML schema lookup moves fully under `/web/api/*`, aligning route ownership with the already-completed backend ownership move.
