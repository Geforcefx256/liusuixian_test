## 1. OpenSpec And Upgrade Contract

- [x] 1.1 Add the breaking-change proposal, design, and delta spec for explicit legacy workspace cleanup before startup
- [x] 1.2 Document the upgrade flow and destructive cleanup expectations in the public README

## 2. Explicit Legacy Cleanup

- [x] 2.1 Add a dedicated backend cleanup script that removes legacy workspace roots and legacy persisted workspace session metadata
- [x] 2.2 Expose the cleanup script through `apps/agent-backend/package.json` so operators can run it intentionally

## 3. Startup Guardrails

- [x] 3.1 Detect legacy workspace naming artifacts during backend startup and fail with an explicit cleanup-required error
- [x] 3.2 Keep the runtime on canonical `upload/project` naming only; do not reintroduce compatibility aliases in runtime loading paths

## 4. Canonical Repository Fixtures And Verification

- [x] 4.1 Update repository-owned governed manifest fixtures and tests to use `uploadDir` / `projectDir`
- [x] 4.2 Add or update tests for cleanup behavior and startup detection, then run the targeted validation suite
