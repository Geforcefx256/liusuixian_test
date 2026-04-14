## Why

当前 `newui` 分支已经具备可用的 Vue workbench、认证链路和受管技能治理能力，但 `apps/agent-backend` 仍缺少源仓库 `agent-V2-base` 中已经验证过的一批运行时增强，例如更完整的模型请求错误分类、工具黑名单、日志落盘、若干 agent/runtime/memory 稳定性改进。需要在不破坏当前 `newui` 前端可用性的前提下，把这些后端能力定向迁入当前仓库。

## What Changes

- 将 `/Users/derrick92/Documents/code/codex/apple-demo` 的 `agent-V2-base` 中与 `agent-backend` 相关的运行时能力定向迁入当前仓库的 `apps/agent-backend`
- 保留当前 `newui` 前端作为唯一 UI 基线，不迁移源仓库 `apps/web`、`packages/agent-core`、`packages/shared`、`packages/mml-core`
- 保留当前认证上下文、角色判断与 admin skill API，不迁移源仓库的单点登录和认证收敛逻辑
- 保留当前 `managedSkillRegistry` 驱动的 governed skill surface，同时引入源仓库的 runtime tool deny list 机制
- 迁移 devlogs 的后端日志落盘与脱敏能力，但不迁移日志前端展示页面
- 保持当前 `newui` 前端依赖的 `/agent/api/*` 接口族、workspace 契约、流式事件契约和协议消息契约可用
- 以源仓库为依赖版本基线，对 `agent-backend` 相关依赖和测试基线进行对齐，但不进行 monorepo 结构迁移
- 关闭 `local:search_in_files` 工具，但保留本地工具实现以便后续按配置重新启用
- 从交付配置中移除 `gateway:local:transform_rows` 与 `mcp:default:transform_rows`，避免它们继续出现在运行时工具目录中

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-backend-runtime`: 扩展运行时迁移要求，要求在引入 `agent-V2-base` 后端能力时保持当前 `newui` 前端契约、认证语义、workspace 接口和 admin skill 接口兼容
- `skill-management`: 明确 managed skill governance 仍然参与 agent 执行面与技能暴露面，同时允许 runtime tool deny list 作为更底层的补充限制机制并存

## Impact

- Affected code:
  - `apps/agent-backend/**`
  - `apps/web/src/api/**`
  - `apps/web/src/stores/workbenchStore.ts`
- Affected APIs:
  - `/agent/api/agents*`
  - `/agent/api/runtime/bootstrap`
  - `/agent/api/agent/*`
  - `/agent/api/files/upload`
  - `/agent/api/admin/skills*`
- Affected systems:
  - Agent runtime execution
  - Managed skill governance
  - Dev log persistence
  - Frontend/backend contract compatibility
- Dependencies:
  - `agent-backend` runtime dependencies and test tooling will align to the source repository baseline where required by the migrated backend features
