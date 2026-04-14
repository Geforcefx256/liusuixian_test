## 1. Freeze compatibility boundaries

- [x] 1.1 Enumerate the `newui` frontend-facing `agent-backend` API, stream-event, workspace, and session-message contracts that must remain stable during migration
- [x] 1.2 Identify the `apps/agent-backend` files that are compatibility-owned by the current branch (`auth/*`, `routes/agent.ts`, `agents/service.ts`, `runtime/tools/providers/skillProvider.ts`, `runtime/tools/index.ts`, `src/index.ts`)
- [x] 1.3 Identify the `agent-V2-base` backend modules that can be migrated as internal implementation upgrades without changing the current frontend contract

## 2. Migrate runtime internals from agent-V2-base

- [x] 2.1 Port provider-client, model-request, and runtime error handling improvements into `apps/agent-backend`
- [x] 2.2 Port agent loop, planner loop, session store, and result-builder runtime fixes into `apps/agent-backend`
- [x] 2.3 Port memory, file-store, support, and runtime bootstrap improvements needed by the migrated backend behavior
- [x] 2.4 Align `apps/agent-backend` dependencies and test tooling with the source repository baseline where required by the migrated backend features

## 3. Reconcile governance, auth, and route boundaries

- [x] 3.1 Merge the runtime tool deny list into the current tool registry while preserving managed skill governance
- [x] 3.2 Preserve current role-aware auth behavior and admin route authorization while excluding source-repository SSO simplifications
- [x] 3.3 Merge source runtime changes into route and catalog layers without removing current workspace APIs or admin skill APIs

## 4. Add backend devlog persistence

- [x] 4.1 Port JSONL devlog sink and redaction support into the current `apps/agent-backend` devlog pipeline
- [x] 4.2 Attach and close devlog file sinks during backend lifecycle startup and shutdown without adding frontend log-view pages

## 5. Verify newui compatibility

- [x] 5.1 Verify `apps/agent-backend` still serves the current `newui` frontend contract for agent detail, bootstrap, sessions, workspace, run streaming, file upload, and admin skill management
- [x] 5.2 Run focused backend tests for migrated runtime, tool-governance, auth, and devlog behavior
- [x] 5.3 Run the current frontend checks needed to confirm the `newui` workbench remains usable against the migrated backend

## 6. Adjust shipped runtime tool surfaces

- [x] 6.1 Disable `local:search_in_files` through shipped runtime deny configuration while keeping the local provider implementation intact
- [x] 6.2 Remove `gateway:local:transform_rows` from shipped gateway configuration instead of masking it only through deny policy
- [x] 6.3 Remove `mcp:default:transform_rows` from shipped MCP configuration by overriding the default fallback surface explicitly
