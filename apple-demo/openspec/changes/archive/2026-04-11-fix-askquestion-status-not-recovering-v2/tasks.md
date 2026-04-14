## 1. 新增独立存储

- [x] 1.1 新增 `awaitingQuestionMessageIdBySession` ref — 在 `workbenchStore.ts` 中声明 `const awaitingQuestionMessageIdBySession = ref<Record<string, number>>({})`，放在 `assistantHeaderOverlays` 附近
- [x] 1.2 新增辅助函数 `setAwaitingQuestionMessageId(sessionId, messageId)` 和 `consumeAwaitingQuestionMessageId(sessionId): number | null`
- [x] 1.3 在 `clearAssistantHeaderOverlays()` 中同步清空 `awaitingQuestionMessageIdBySession.value = {}`

## 2. 写入与读取

- [x] 2.1 修改 `run.completed` handler — 在 `awaiting-interaction` 分支中调用 `setAwaitingQuestionMessageId(context.sessionId, event.result.assistantMessageId)` 替代写入 `SessionActivityViewState`
- [x] 2.2 修改 `replyPendingInteraction` — 在 `clearSessionInteractions` 之前，调用 `consumeAwaitingQuestionMessageId(activeSessionId.value)` 获取 messageId，若存在则调用 `rememberAssistantHeaderOverlay(id, ANSWERED_ASSISTANT_HEADER)`
- [x] 2.3 修改 `rejectPendingInteraction` — 在 `clearSessionRun` 之前，调用 `consumeAwaitingQuestionMessageId(sessionId)` 获取 messageId，若存在则调用 `rememberAssistantHeaderOverlay(id, REJECTED_QUESTION_ENDED_ASSISTANT_HEADER)`

## 2b. overlay 即时生效（方案 C）

- [x] 2b.1 修改 `rememberAssistantHeaderOverlay` — 在更新 overlay ref 后，调用 `updateDisplayedMessage(\`persisted-${messageId}\`, message => ({ ...message, assistantHeader }))` 立即更新已渲染的 message 对象

## 3. 清理 v1 残留

- [x] 3.1 移除 `SessionActivityViewState.awaitingAssistantMessageId` 字段定义
- [x] 3.2 移除 `run.completed` handler 中向 `setSessionActivity` 传递 `awaitingAssistantMessageId` 的代码
- [x] 3.3 移除 `replyPendingInteraction` 和 `rejectPendingInteraction` 中从 `readSessionActivity` 读取 `awaitingAssistantMessageId` 的旧代码

## 4. 验证

- [ ] 4.1 手动验证：提交回答后消息标签从"等待你确认"变为"已回答"
- [ ] 4.2 手动验证：拒绝问题后消息标签变为"任务已结束"
- [ ] 4.3 手动验证：连续两次 askQuestion（回答第一个后触发第二个），两条消息标签分别正确
