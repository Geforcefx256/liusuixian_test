## Tasks

- [x] 1. 扩展 SessionActivityViewState 接口 — 在 `SessionActivityViewState` 接口中新增 `awaitingAssistantMessageId?: number` 字段
- [x] 2. 新增 ANSWERED_ASSISTANT_HEADER 常量 — 新增 `const ANSWERED_ASSISTANT_HEADER = createAssistantHeader('已回答', 'summary')`
- [x] 3. run.completed handler 记录 assistantMessageId — 在 `awaiting-interaction` 分支的 `setSessionActivity` 调用中加入 `awaitingAssistantMessageId: event.result.assistantMessageId`
- [x] 4. replyPendingInteraction 更新 overlay — 在 `clearSessionInteractions` 之前，读取 `awaitingAssistantMessageId`，若存在则调用 `rememberAssistantHeaderOverlay(id, ANSWERED_ASSISTANT_HEADER)`
- [x] 5. rejectPendingInteraction 更新 overlay — 在 `clearSessionRun` 之前，读取 `awaitingAssistantMessageId`，若存在则调用 `rememberAssistantHeaderOverlay(id, REJECTED_QUESTION_ENDED_ASSISTANT_HEADER)`
- [ ] 6. 验证 — 手动验证各项场景
