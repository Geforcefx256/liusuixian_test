## 1. Frontend Route Cutover

- [x] 1.1 Add a dedicated web-side MML schema API module that calls `/web/api/mml/schema` with the existing authenticated browser session contract.
- [x] 1.2 Switch `WorkspaceEditorPane` and any related frontend schema-loading logic from `agentApi.getMmlSchema()` to the new web-side API without changing downstream table or Monaco behavior.
- [x] 1.3 Update frontend tests and mocks so MML schema loading expectations target the new web-side API contract.

## 2. Agent-Backend Proxy Removal

- [x] 2.1 Remove `/agent/api/files/mml-schema` from `apps/agent-backend/src/routes/files.ts` and delete any dedicated proxy client or helper code that only supported that route.
- [x] 2.2 Delete or update agent-backend tests that still exercise the removed compatibility route, keeping only coverage that matches the remaining supported runtime surface.
- [x] 2.3 Remove README and runtime documentation statements that describe `agent-backend` as an MML schema compatibility facade.

## 3. Verification

- [x] 3.1 Verify the authenticated workbench still loads MML schema from `web-backend` and preserves existing table-view and text-assistance gating behavior.
- [x] 3.2 Verify missing-schema and route-error cases still degrade cleanly in the workbench after the transport cutover.
- [x] 3.3 Verify no supported browser or test path still depends on `/agent/api/files/mml-schema`.
