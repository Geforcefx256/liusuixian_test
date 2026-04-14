## Why

The current MML rule import, storage, and schema lookup lifecycle lives inside `apps/agent-backend`, but that service is primarily the agent runtime and workspace execution backend rather than the product-owned rule catalog service. Keeping MML rules there creates a responsibility mismatch, duplicates product data concerns into the wrong backend, and makes future rule governance harder just as the workbench is becoming more dependent on the Excel-backed schema.

## What Changes

- Move canonical MML rule ownership from `apps/agent-backend` to `apps/web-backend`, including Excel workbook import, active ruleset storage, and schema assembly.
- Add an authenticated canonical route at `/web/api/mml/schema` for `networkType + networkVersion` schema lookup.
- Keep `/agent/api/files/mml-schema` available for the current frontend, but change it from a local owner route into a compatibility proxy that fetches schema from `web-backend`.
- Remove agent-backend ownership of the local MML rule database, import-on-startup bootstrap, and rule-store lifecycle.
- Re-home related tests, config expectations, and service documentation so there is one clear backend owner for MML rule catalogs.

## Capabilities

### New Capabilities
- `web-mml-rule-catalog`: canonical web-backend ownership of imported Excel-backed MML rule catalogs and authenticated schema lookup.

### Modified Capabilities
- `agent-backend-runtime`: preserve `/agent/api/files/mml-schema` as a frontend-compatible compatibility facade while delegating rule ownership and schema sourcing to `web-backend`.

## Impact

- `apps/web-backend/src/*` gains MML rule import/storage/bootstrap logic, the canonical `/web/api/mml/schema` route, and related tests and config.
- `apps/agent-backend/src/index.ts`, `apps/agent-backend/src/routes/files.ts`, auth/web-backend client wiring, and MML-rule-specific config lose local rule ownership and become a thin proxy path.
- The current frontend contract in `apps/web/src/api/agentApi.ts` remains unchanged during this phase.
- `apps/web-backend/package.json` will need the Excel parsing dependency currently owned by `agent-backend`.
