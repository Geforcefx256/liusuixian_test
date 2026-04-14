## Why

当前工作区命名同时存在 `upload/project`、`input/working`、`upload/output`、`uploads/outputs` 四套词汇，前端、后端、LLM 工具契约、skill 执行器各自暴露不同命名，已经造成实现漂移和路径理解混乱。需要一次性统一成 `upload / project`，让用户、前端、后端、模型和脚本都使用同一套命名。

## What Changes

- **BREAKING** 将工作区公共命名从 `input` / `working` 统一为 `upload` / `project`，覆盖后端 API payload、前端类型、运行时 session metadata、workspace-relative path、LLM 文件上下文和测试断言。
- **BREAKING** 将运行时与工具契约中的 `output` / `outputs` 统一为 `project`，覆盖 `local:write`、`artifact_ref`、workspace file `source`、skill 执行路径前缀、script path base 命名和相关错误信息。
- **BREAKING** 将工作区文件与目录创建/重命名接口中的 `working` 概念统一为 `project`，包括文件路由、前端 API 调用名与返回结构。
- 删除前端和后端之间现有的命名翻译层，不再把一套命名映射成另一套命名。
- 明确本次改动不提供旧命名兼容层，也不处理历史数据迁移。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: workspace metadata、workspace path、workspace file source、write tool、workspace file/folder APIs 与运行时存储命名统一改为 `upload` / `project`
- `governed-skill-script-execution`: governed skill script 的 scoped path、artifact_ref、pathBase、环境变量与结果契约统一改为 `upload` / `project`

## Impact

- Affected code:
  - `apps/agent-backend/src/files/**`
  - `apps/agent-backend/src/routes/**`
  - `apps/agent-backend/src/runtime/tools/**`
  - `apps/agent-backend/src/skills/**`
  - `apps/agent-backend/assets/agents/workspace-agent/**`
  - `apps/web/src/api/**`
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/components/workbench/**`
- Affected APIs:
  - workspace metadata `groupId`
  - workspace file `source`
  - workspace-relative `path`
  - working/project file and folder creation or rename routes
  - `local:write` contract
  - governed skill script artifact path contract
- Dependencies: none
