## Why

当前 `apps/web` 已经具备可用的工作台首页、会话态和右侧上下文区，但 Agent 身份表达仍与 `index-v10.html` 存在明显偏差：首页与会话态仍使用简化的文本 badge，会话态的 Agent 标题栏层级偏弱，右侧上下文区与主内容区的 Agent 命名来源也缺少显式一致性约束。现在收敛这一轮视觉与命名问题，可以在不改变现有运行时链路的前提下，消除产品割裂感，并把“小曼智能体”作为后端驱动的正式名称稳定下来。

## What Changes

- 对齐首页与会话态的 Agent badge / icon 语言，使其与 `index-v10.html` 的 Agent identity 表达保持一致。
- 强化现有会话态 Agent identity bar 的视觉层级与结构表达，但不新增第二层标题栏，也不改变消息区和会话流逻辑。
- 统一首页、会话态和右侧上下文区的 Agent 标题显示优先级，确保用户可见名称继续来自后端 Agent 元数据，而不是前端硬编码。
- 将当前 `workspace-agent` 的后端显示名称调整为 `小曼智能体`，并要求该名称自动传播到相关前端展示区域。
- 保持现有认证、session、streaming、planner/build、技能治理和 phase 1 轻量 workspace 约束不变。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: refine the Agent identity presentation requirements so the home stage, active session header, and workspace context panel align with `index-v10.html` and use backend-driven Agent naming consistently.

## Impact

- Affected code: `apps/web/src/styles.css`, `apps/web/src/components/workbench/WorkbenchShell.vue`, `apps/web/src/components/workbench/HomeStage.vue`, `apps/web/src/components/workbench/ConversationPane.vue`, `apps/web/src/components/workbench/WorkspaceContextPane.vue`, `apps/agent-backend/assets/agents/workspace-agent/AGENT.md`
- Unchanged systems: `apps/web/src/stores/workbenchStore.ts`, `apps/web/src/api/*`, `apps/agent-backend/src/routes/*`, runtime bootstrap/session/run APIs, auth flows
- UX impact: the workbench presents a consistent Agent identity across home, active session, and context surfaces, and the current Agent appears to end users as `小曼智能体`
