## Why

当前工作区文件只支持上传、新建、打开和保存，用户无法在前端删除已经不再需要的上传文件、手工新建文件或运行时输出文件。随着工作区长期复用到同一 `user + agent` 作用域，文件会持续累积，影响工作区可读性，也让用户无法主动清理高风险或过期产物。

## What Changes

- 为 `apps/agent-backend` 工作区文件路由新增显式删除能力，允许按当前 `user + agent` scope 删除工作区文件索引与对应磁盘文件。
- 扩展运行时工作区 contract，使上传文件、可编辑工作区文件和 `outputs/` 中的运行时产物都可以通过统一删除流被前端删除。
- 为 `apps/web` 工作台新增工作区文件删除 API、store 动作和状态收敛逻辑，删除后自动刷新工作区列表并关闭失效编辑标签。
- 调整工作区 Sidebar 文件行结构，在每个文件行提供独立删除图标，并保持单击选中、双击打开的现有交互不变。
- 在前端删除确认中加入高风险提示，明确告知用户删除后不可恢复、可能影响当前会话或后续执行，同时允许用户继续执行删除。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 工作区文件列表需要支持行级删除入口、风险确认弹窗，以及删除后的编辑器/侧栏状态收敛。
- `agent-backend-runtime`: 工作区文件 contract 需要支持前端显式删除上传文件和 `outputs/` 文件，并在删除后更新对应 workspace metadata。

## Impact

- Affected code:
  - `apps/agent-backend/src/routes/files.ts`
  - `apps/agent-backend/src/files/fileStore.ts`
  - `apps/agent-backend/tests/files.routes.test.ts`
  - `apps/web/src/api/agentApi.ts`
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/components/workbench/WorkspaceSidebar.vue`
  - related frontend unit tests
- APIs:
  - add workspace file delete endpoint under `/agent/api/files/:fileKey`
  - extend frontend agent API usage for workspace deletion
- Dependencies:
  - no new third-party dependencies are required
- Systems:
  - workspace file metadata persistence in `apps/agent-backend/workspace`
  - workbench sidebar/editor state coordination in `apps/web`
