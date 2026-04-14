## 1. Web-Backend Canonical Rule Catalog

- [x] 1.1 Add `web-backend` config and dependency support for fixed MML rule workbook import and dedicated rule DB storage.
- [x] 1.2 Move or re-home the Excel-backed MML rule modules and schema assembly logic so `web-backend` owns bootstrap, import, storage, and lookup end to end.
- [x] 1.3 Add the authenticated `/web/api/mml/schema` route and wire it through the existing `web-backend` routing and auth middleware.
- [x] 1.4 Add `web-backend` tests for workbook import, checksum skip behavior, active-ruleset replacement, route auth, and schema responses.

## 2. Agent-Backend Compatibility Facade

- [x] 2.1 Replace `agent-backend` local MML rule bootstrap/store wiring with a thin client that calls the canonical `web-backend` schema route.
- [x] 2.2 Keep `/agent/api/files/mml-schema` frontend-compatible by proxying request auth context, success payloads, and failure cases from `web-backend`.
- [x] 2.3 Remove agent-owned MML rule lifecycle config and tests that are no longer valid after the ownership move, while adding proxy-focused coverage.

## 3. Contract And Rollout Verification

- [x] 3.1 Update OpenSpec deltas and service documentation so `web-backend` is the only documented owner of MML rule catalogs.
- [x] 3.2 Verify the current frontend continues to load MML schema through the existing `/agent/api/files/mml-schema` path without route changes.
- [x] 3.3 Verify service startup and packaging still include the workbook sources, database path handling, and runtime dependencies required after the ownership move.
