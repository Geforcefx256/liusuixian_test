## Why

当前 `Skill 管理` 页面把 `用户可见名称` 挂在每个 Agent 绑定项下面，导致“展示治理”和“分发治理”混在同一个区域里：管理员既要先理解为什么名称不在基础信息里，又要面对“是否要给每个 Agent 配不同名字”的额外复杂度。既然产品上已经确认不再需要每个 Agent 一个可见名称，现在应当把治理模型收敛为 skill 级基础信息与 agent 级绑定范围两层，减少心智负担，也同步简化后端数据模型和管理 API。

## What Changes

- 将 `用户可见名称` 从 `agentBindings[].displayName` 收敛为 managed skill 自身的统一治理字段，并在管理 UI 中归入 `基础信息` 区域。
- 将 `Agent 绑定范围` 简化为“哪些 agent 可以加载该 skill”的纯绑定职责，不再承载用户可见名称输入框。
- **BREAKING** 调整 managed skill 管理数据模型与 admin API：移除每个 agent 绑定项中的 `displayName` 治理字段，统一由 skill 级 `displayName` 表达用户可见名称。
- 更新运行时治理解析与用户发现面：同一 canonical skill 在所有已绑定 agent 上使用同一套治理后名称与描述。
- 补充前后端测试与必要的数据迁移/兼容处理，确保现有 managed skill 记录可以平滑过渡到新模型。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: managed skill 的用户可见名称从 agent 级治理收敛为 skill 级基础信息，agent 绑定仅保留启用范围语义。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/AdminSkillManagement.vue`
  - `apps/web/src/api/types.ts`
  - `apps/web/src/api/agentApi.ts`
  - `apps/agent-backend` managed skill registry / admin API / runtime governed metadata resolution
  - related frontend and backend tests
- APIs:
  - admin skill list / update payload 中的治理名称字段从 `agentBindings[].displayName` 收敛为 skill 级字段
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - Skill 管理信息架构、managed skill 持久化模型、governed runtime metadata、用户发现面命名解析
