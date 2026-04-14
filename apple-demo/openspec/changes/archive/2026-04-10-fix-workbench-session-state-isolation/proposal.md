## Why

当前 workbench 已支持同一 Agent 下多个 session 并发运行，但前端仍保留了部分全局会话 UI 状态和基于 `activeSessionId` 的异步清理逻辑。用户在多个会话之间频繁切换并发送消息时，容易出现状态栏串感、同一 session 旧请求回写新视图、以及失败后运行态清理落到错误会话的问题，削弱会话隔离的可信度。

## What Changes

- 将会话级 UI 状态从全局字段调整为按 session 归属存储，避免后台 session 的计划摘要、运行状态或错误提示覆盖当前查看会话的上下文面板。
- 为 session 切换与重载引入请求代次约束，阻止同一 session 的旧异步响应覆盖较新的视图状态。
- 将 run 失败、取消和异常清理逻辑绑定到 run-owning session，而不是绑定到当前激活会话，避免切换会话后清错运行态或错误消息。
- 补充 workbench store 测试，覆盖快速切换会话、后台 session 流式更新、以及异常回收等竞态场景。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `agent-web-workbench`: 调整 workbench 的会话状态归属、会话切换回写规则和运行异常清理要求，确保多会话并发使用时的前端展示与会话所有权保持一致。

## Impact

- Affected specs: `openspec/specs/agent-web-workbench/spec.md`
- Affected frontend: `apps/web/src/stores/workbenchStore.ts`, `apps/web/src/components/workbench/WorkspaceContextPane.vue`, related workbench session state consumers
- Affected tests: `apps/web/src/stores/workbenchStore.test.ts`
- 不涉及后端 API 语义调整。
- 不涉及新增或升级第三方依赖。
- 不涉及顶层目录结构变更。
