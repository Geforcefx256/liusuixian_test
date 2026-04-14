## Why

当前工作区文件只支持下载和删除，缺少显式重命名能力，用户无法在同一 `user + agent` 工作目录内整理上传文件和可编辑输出文件的名称。与此同时，删除能力仍允许对正在运行或存在未保存修改的文件继续操作，容易让工作区状态与用户预期脱节。

## What Changes

- 为 `apps/agent-backend` 工作区文件路由新增显式重命名能力，允许按当前 `user + agent` scope 重命名 upload 文件和基于 `relativePath` 的 output 文件。
- 将重命名 v1 范围限定为“仅修改 basename”，不允许修改目录、不允许修改扩展名、不支持仅大小写变化的重命名，并对同 scope 同类文件名冲突返回显式错误。
- 要求后端在重命名过程中同步维护磁盘文件、内存索引与 `file-map.json`，当 metadata 持久化失败时回滚到旧状态并显式暴露错误。
- 在 `apps/web` 工作台新增工作区文件重命名 API、store 动作和侧栏入口，并在重命名成功后保持当前文件 identity 不变，仅更新文件展示名与路径。
- 收紧工作区危险操作约束：前端在文件正在运行中或存在未保存修改时，不允许执行删除或重命名。
- 保留 legacy output 的现有读取兼容逻辑，但本次 change 不为 legacy output 提供重命名支持，也不移除 legacy 兼容代码。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 工作区文件 contract 需要支持受约束的显式重命名，并对超出 v1 范围的重命名请求显式拒绝。
- `agent-web-workbench`: 工作区文件列表与编辑器状态需要支持重命名入口、危险状态拦截，以及重命名后的前端状态收敛。

## Impact

- Affected code:
  - `apps/agent-backend/src/routes/files.ts`
  - `apps/agent-backend/src/files/fileStore.ts`
  - `apps/agent-backend/src/files/workspaceFileEditor.ts`
  - `apps/agent-backend/tests/files.routes.test.ts`
  - `apps/agent-backend/src/files/fileStore.test.ts`
  - `apps/web/src/api/agentApi.ts`
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/components/workbench/WorkspaceFileActionMenu.vue`
  - `apps/web/src/components/workbench/WorkspaceSidebar.vue`
  - related frontend unit tests
- APIs:
  - add workspace file rename endpoint under `/agent/api/files/:fileKey/rename`
  - tighten frontend destructive-action behavior for running or dirty files
- Dependencies:
  - no new third-party dependencies are required
- Systems:
  - workspace file metadata persistence in `apps/agent-backend/workspace`
  - workbench sidebar/editor state coordination in `apps/web`
