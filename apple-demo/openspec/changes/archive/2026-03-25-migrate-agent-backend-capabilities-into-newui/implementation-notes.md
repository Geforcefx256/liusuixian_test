## Compatibility Boundary Baseline

### 1.1 Stable `newui` frontend contracts

The current `newui` frontend in `apps/web` depends on the following `apps/agent-backend` surfaces and payload shapes remaining stable during migration.

#### HTTP APIs

- `GET /agent/api/agents`
  - Returns `{ ok, agents }`
  - `agents[*]` must preserve `id`, `name`, `description`, `version`, `skillCount`
- `GET /agent/api/agents/:agentId`
  - Returns `{ ok, agent }`
  - `agent` must preserve `runtime`, `presentation`, and governed `skills`
- `GET /agent/api/runtime/bootstrap?agentId=...`
  - Returns `{ ok, bootstrap }`
  - `bootstrap.workspaceAgent` must preserve `plannerEnabled` and `defaultPrimaryAgent`
  - `bootstrap.gateway.tools[*]` must preserve current manifest shape
- `GET /agent/api/agent/sessions?agentId=...`
  - Returns `{ ok, sessions }`
  - `sessions[*]` must preserve `activePrimaryAgent` and `planState`
- `POST /agent/api/agent/sessions`
  - Accepts `{ agentId, title? }`
  - Returns `{ ok, session }`
- `DELETE /agent/api/agent/sessions/:sessionId?agentId=...`
  - Returns `{ ok, sessionId }`
- `GET /agent/api/agent/sessions/:sessionId/messages?agentId=...`
  - Returns `{ ok, messages, nextCursor, hasMore }`
  - `messages[*]` must preserve `kind`, `protocol`, `domainResult`, `protocolState`
- `PATCH /agent/api/agent/sessions/:sessionId/messages/:messageId/protocol-state`
  - Accepts `{ agentId, protocolState }`
  - `protocolState` must remain nullable object-only payload
- `POST /agent/api/agent/sessions/:sessionId/plan/decision`
  - Accepts `{ agentId, decision, planId? }`
  - Returns `{ ok, session, plan }`
- `GET /agent/api/agent/workspace?agentId=...`
  - Returns `{ ok, workspace }`
- `GET /agent/api/agent/sessions/:sessionId/workspace?agentId=...`
  - Returns `{ ok, workspace }`
- `PATCH /agent/api/agent/sessions/:sessionId/workspace`
  - Current frontend expects current compatibility behavior and response shape, even though it delegates to `getWorkspace`
- `POST /agent/api/agent/run`
  - Accepts `AgentRunRequest`
  - Streams NDJSON events
- `POST /agent/api/files/upload?agentId=...`
  - Returns current uploaded file payload
- `GET /agent/api/admin/skills`
  - Returns `{ ok, skills, agents }`
- `POST /agent/api/admin/skills/import`
  - Returns `{ ok, skills }`
- `PATCH /agent/api/admin/skills/:skillId`
  - Returns `{ ok, skill }`

#### Stream-event contracts

`apps/web/src/api/agentApi.ts` parses `/agent/api/agent/run` as NDJSON and expects:

- `lifecycle.start`
- `lifecycle.queued`
- `assistant.delta`
- `assistant.final`
- `lifecycle.error`
  - May include `runtimeError`
- `metrics.run`
- `context.log`
- `plan.awaiting_decision`
- `run.completed`

`run.completed.result` must preserve:

- `runId`
- `sessionId`
- `agentId`
- `assistantMessageId?`
- `output.kind`
- `output.protocol?`
- `output.domainResult?`
- `text`
- `runtimeError?`
- `metrics?`
- `completedAt`

#### Workspace contracts

The workspace payload consumed by `apps/web/src/stores/workbenchStore.ts` and sidebar components must remain:

- `workspace.agentId`
- `workspace.title`
- `workspace.tasks[*].id`
- `workspace.tasks[*].label`
- `workspace.tasks[*].groups[*].id`
- `workspace.tasks[*].groups[*].label`
- `workspace.tasks[*].groups[*].files[*].fileId`
- `workspace.tasks[*].groups[*].files[*].fileKey`
- `workspace.tasks[*].groups[*].files[*].fileName`
- `workspace.tasks[*].groups[*].files[*].source`
- `workspace.tasks[*].groups[*].files[*].groupId`
- `workspace.tasks[*].groups[*].files[*].addedAt`

The grouping structure must remain `tasks -> groups -> files`, with `input` and `output` groups preserved.

#### Session-message contracts

Persisted session messages returned by `/sessions/:sessionId/messages` must preserve:

- `messageId`
- `role`
- `text`
- `createdAt`
- `kind`
- `protocol?`
- `domainResult?`
- `protocolState?`

`kind: "protocol"` and `kind: "result"` semantics must remain compatible with the current workbench renderers.

### 1.2 Compatibility-owned files in the current branch

These files remain current-branch-owned compatibility boundaries and must be merged manually instead of replaced wholesale:

- `apps/agent-backend/src/auth/authClient.ts`
- `apps/agent-backend/src/auth/authConfig.ts`
- `apps/agent-backend/src/auth/requireUser.ts`
- `apps/agent-backend/src/auth/requireAdmin.ts`
- `apps/agent-backend/src/routes/agent.ts`
- `apps/agent-backend/src/agents/service.ts`
- `apps/agent-backend/src/runtime/tools/providers/skillProvider.ts`
- `apps/agent-backend/src/runtime/tools/index.ts`
- `apps/agent-backend/src/index.ts`

Ownership rationale:

- `auth/*` preserves current role-aware auth context and admin authorization semantics
- `routes/agent.ts` preserves workspace endpoints, session-message payloads, and plan-decision compatibility
- `agents/service.ts` preserves governed catalog behavior exposed to the current frontend
- `runtime/tools/providers/skillProvider.ts` preserves managed-skill approval and governed skill-body restrictions
- `runtime/tools/index.ts` preserves the governed skill provider wiring while becoming the integration point for deny-list support
- `src/index.ts` preserves current route topology, startup sequence, and admin skill route registration

### 1.3 Source modules safe to migrate as internal implementation upgrades

The following `agent-V2-base` modules can be migrated as internal implementation upgrades because they primarily affect runtime internals rather than frontend contracts, provided the compatibility-owned files above stay in control of the boundary surface:

#### Agent runtime internals

- `src/agent/providerClient.ts`
- `src/agent/modelRequestError.ts`
- `src/agent/executionErrors.ts`
- `src/agent/toolFailureRetry.ts`
- `src/agent/skillResult.ts`
- `src/agent/agentLoop.ts`
- `src/agent/loopTypes.ts`
- `src/agent/chatOrchestrator.ts`
- `src/agent/service/RunExecution.ts`
- `src/agent/service/resultBuilders.ts`
- `src/agent/service/runtimeErrors.ts`
- `src/agent/sessionStore.ts`
- `src/agent/sessionStoreTypes.ts`
- `src/agent/sessionStoreUtils.ts`
- `src/agent/workspace/planner.ts`
- `src/agent/workspace/plannerLoop.ts`
- `src/runtime/bootstrap.ts`

#### Support, memory, and storage internals

- `src/files/fileStore.ts`
- `src/memory/ConfigLoader.ts`
- `src/memory/EmbeddingProvider.ts`
- `src/memory/types.ts`
- `src/support/runtimePaths.ts`
- `src/http/sameOrigin.ts`

#### Devlog internals

- `src/devlogs/fileSink.ts`
- `src/devlogs/redaction.ts`
- `src/devlogs/store.ts`
- `src/devlogs/types.ts`
- `src/devlogs/index.ts`
- `src/devlogs/consoleBridge.ts`

#### Tooling internals that can be merged beneath governance boundaries

- `src/runtime/tools/registry.ts`
- `src/runtime/tools/providers/localProvider.ts`
- `src/runtime/tools/local/*`
- `src/runtime/tools/providers/gatewayProvider.ts`
- `src/runtime/tools/providers/mcpProvider.ts`

#### Explicit exclusions from wholesale migration

- Source `auth/*` simplifications that only return `userId`
- Source `routes/agent.ts` route behavior that drops current workspace APIs
- Source removal of managed skill governance from runtime skill exposure
- Source frontend devlog pages and frontend runtime modules
- Source monorepo structure and non-`apps/agent-backend` package moves
