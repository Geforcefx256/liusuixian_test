## Why

Agent 使用 askQuestion 向用户提问时，消息左上角状态标签显示"等待你确认"。用户提交回答后，该标签应更新为"已回答"，但实际上仍停留在"等待你确认"不变。v1 方案将 `awaitingAssistantMessageId` 存入 `SessionActivityViewState`，但 `runConversationInput` 中 `runStream` 返回后紧接调用的 `refreshSessions()` → `syncSessionRuntimeFromSessions()` 会用 session list API 返回的 activity（仅含 `active/state/runId`）整体覆盖 `sessionActivityById.value`，把该字段冲掉。等到用户回答时，`replyPendingInteraction` 已读不到 `awaitingAssistantMessageId`，overlay 更新逻辑被跳过。

## What Changes

- **新增独立 ref `awaitingQuestionMessageIdBySession`**：类型 `Record<string, number>`，按 sessionId 存储等待中的 `assistantMessageId`，不参与 `syncSessionRuntimeFromSessions` 的覆盖
- **`run.completed` handler 写入独立 ref**：在 `awaiting-interaction` 分支中调用新的写入函数，替代写入 `SessionActivityViewState.awaitingAssistantMessageId`
- **`replyPendingInteraction` 从独立 ref 读取并更新 overlay**：读取 sessionId 对应的 messageId，调用 `rememberAssistantHeaderOverlay(id, ANSWERED_ASSISTANT_HEADER)` 后清除该条目
- **`rejectPendingInteraction` 从独立 ref 读取并更新 overlay**：同理，将 header 更新为"任务已结束"后清除
- **`rememberAssistantHeaderOverlay` 内聚即时更新**：在更新 overlay ref 的同时，自动调用 `updateDisplayedMessage` 更新已渲染的 message 对象，使 header 变更立即反映到 UI，不依赖后续 `reloadSessionState` 重建消息
- **移除 v1 残留**：删除 `SessionActivityViewState.awaitingAssistantMessageId` 字段及相关读写代码

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `agent-web-workbench`：askQuestion 交互完成后的消息状态标签恢复逻辑——将等待中消息 ID 的存储从 `sessionActivityById`（会被 session list 同步覆盖）迁移到独立 ref

## Impact

- 前端 Store：`apps/web/src/stores/workbenchStore.ts`
  - 新增 `awaitingQuestionMessageIdBySession` ref 及读写/清除辅助函数
  - 修改 `run.completed` handler（line ~2349）
  - 修改 `replyPendingInteraction`（line ~2596）
  - 修改 `rejectPendingInteraction`（line ~2629）
  - 移除 `SessionActivityViewState.awaitingAssistantMessageId`
  - 保留 `ANSWERED_ASSISTANT_HEADER` 常量（v1 已新增）
- 不引入新的第三方依赖
- 不影响后端逻辑
- 不影响消息持久化和历史回放
- `applyRunResultToDisplayedMessage` 已有 `updateDisplayedMessage` 调用，`rememberAssistantHeaderOverlay` 内部的自动更新是等价冗余，无副作用
