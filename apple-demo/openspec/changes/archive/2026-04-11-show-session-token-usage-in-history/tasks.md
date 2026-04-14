## 1. Backend session usage aggregation

- [x] 1.1 在 `apps/agent-backend/src/agent/sessionStoreTypes.ts` 中新增 session usage summary 类型，覆盖累计 `totalTokens`、输入/输出 token、cache token 和命中消息数。
- [x] 1.2 在 `apps/agent-backend/src/agent/sessionStore.ts` 中新增按 `sessionId` 聚合 assistant `meta.usage` 的读取方法，仅统计已落库的 assistant message usage。
- [x] 1.3 在 `apps/agent-backend/src/routes/agent.ts` 中新增独立的 admin-only session usage 查询接口，并确保失败只影响该查询路径而不影响普通 `/agent/run` 对话流程。

## 2. Workbench history display

- [x] 2.1 在 `apps/web/src/api/types.ts` 与 `apps/web/src/api/agentApi.ts` 中新增 session usage summary 的前端类型与请求方法。
- [x] 2.2 在 `apps/web/src/stores/workbenchStore.ts` 或历史面板局部状态中新增按 `sessionId` 缓存 usage 的读取状态，并仅对 `admin` / `super_admin` 触发查询。
- [x] 2.3 更新 `apps/web/src/components/workbench/SessionRail.vue`，在历史会话项中为管理员渲染弱化 token badge，并确保普通用户、当前会话主区域和失败场景都不展示伪造 token 值。

## 3. Validation

- [x] 3.1 为 backend usage 聚合与权限控制补充最小测试，覆盖管理员读取、非管理员拒绝和空会话零值摘要。
- [x] 3.2 为 frontend 历史会话展示补充测试，覆盖管理员 badge 展示、普通用户不渲染以及 usage 加载失败不阻断列表交互。
- [x] 3.3 运行相关 type-check 与目标测试，确认本次变更不会破坏历史会话面板和正常对话流程。
