## Why

The recent workspace naming rename from `input/working/output(s)` to `upload/project` is a breaking change, but the runtime still encounters persisted legacy workspace data after upgrade. Leaving that data in place causes ambiguous failures such as 404 file access, dropped session workspace context, and startup-time validation mismatches.

## What Changes

- **BREAKING** Require explicit cleanup of legacy workspace naming data before `apps/agent-backend` can start with the canonical `upload/project` runtime.
- Add a repository-owned cleanup script that removes legacy workspace roots and persisted legacy workspace metadata instead of attempting runtime compatibility.
- Add startup-time detection that refuses to initialize the workspace runtime while legacy naming artifacts still exist on disk or in persisted session metadata.
- Update repository-owned governed manifest fixtures and tests to use only `uploadDir` / `projectDir` naming.
- Document the upgrade procedure and data loss expectations in the public project documentation.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: Require explicit cleanup of legacy workspace naming data before startup and document the breaking upgrade path.

## Impact

- Affected code: `apps/agent-backend/src/files`, `apps/agent-backend/src/agent`, `apps/agent-backend/scripts`, backend tests, and root `README.md`
- Affected systems: persisted workspace storage under `apps/agent-backend/workspace`, session metadata storage, and repository-governed script manifest fixtures
- Dependencies: none
