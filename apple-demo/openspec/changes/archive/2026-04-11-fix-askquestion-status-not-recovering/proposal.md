## Why

Agent 使用 askQuestion 向用户提问时，消息左上角状态标签显示"等待你确认"。用户提交回答后，该标签应更新为"已回答"，但实际上仍停留在"等待你确认"不变。原因是 `assistantHeaderOverlays` 在写入"等待你确认"后，`replyPendingInteraction` 和 `rejectPendingInteraction` 均未更新该 overlay，而 `clearAssistantHeaderOverlays()` 仅在切换/创建会话和全局重置时触发，导致旧消息标签在同一会话中永远不会恢复。

## What Changes

- **SessionActivityViewState 扩展**：新增 `awaitingAssistantMessageId?: number` 字段，在 `run.completed` 事件将 `awaiting-interaction` 状态写入 activity 时，同时记录 `event.result.assistantMessageId`（后端持久化 ID），建立 session → 等待中消息的精确关联
- **回答后更新 overlay**：`replyPendingInteraction` 在提交回答后，从 activity 中读取 `awaitingAssistantMessageId`，调用 `rememberAssistantHeaderOverlay` 将该消息的 header 更新为"已回答"
- **拒绝后更新 overlay**：`rejectPendingInteraction` 同理，将 header 更新为已有的"任务已结束"标签
- **新增常量**：`ANSWERED_ASSISTANT_HEADER = createAssistantHeader('已回答', 'summary')`

## Capabilities

### Modified Capabilities

- `agent-web-workbench`：askQuestion 交互完成后的消息状态标签更新逻辑

## Impact

- 前端 Store：`apps/web/src/stores/workbenchStore.ts`
  - `SessionActivityViewState` 接口扩展（line 175）
  - `run.completed` handler 中 `setSessionActivity` 调用扩展（line 2349）
  - `replyPendingInteraction` 新增 overlay 更新（line 2590）
  - `rejectPendingInteraction` 新增 overlay 更新（line 2610）
  - 新增 `ANSWERED_ASSISTANT_HEADER` 常量（line 227 附近）
- 不引入新的第三方依赖
- 不影响后端逻辑
- 不影响消息持久化和历史回放
- 多会话安全：每个 session 通过 `sessionActivityById` 独立维护 `awaitingAssistantMessageId`，不会跨会话误改
