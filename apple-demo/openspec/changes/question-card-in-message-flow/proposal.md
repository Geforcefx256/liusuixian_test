## Why

工作台对话中，LLM 调用 `local:question` 工具时生成的问题卡片（PendingQuestionCard）渲染在 composer 区域（布局独立于滚动容器），卡片内容过长时会撑高 composer、压缩消息区，导致滚轮失效、用户无法正常浏览历史消息。

## What Changes

- 将 `PendingQuestionCard` 从 composer 区域移入消息流，作为消息列表的最后一条 item 渲染
- 在前端内存层新增 `UiQuestionMessage` 消息类型，将 `pendingInteraction` 注入 `messages[]`
- 卡片出现时自动触发 autoScroll（利用现有 `useConversationAutoScroll` 对 `messages[]` 的 watch 机制）
- 移除 composer 区原有的 `v-if="pendingInteraction"` 渲染块
- 已回答/拒绝的问题卡片历史展示方式不变（保持现有"已提交回答：..."摘要文本）

## Capabilities

### New Capabilities

- `question-card-in-message-flow`: 问题卡片作为消息流的一部分渲染，支持正常滚动、自动定位和历史回显

### Modified Capabilities

（无现有 spec 层级行为变更）

## Impact

- `apps/web/src/stores/workbenchStore.ts`：新增 `UiQuestionMessage` 类型，修改 `setSessionInteractions` 和 `buildHydratedSessionMessages`
- `apps/web/src/components/workbench/ConversationPane.vue`：消息列表新增 question 渲染分支，移除 composer 区卡片渲染
- `apps/web/src/components/workbench/conversationDisplay.ts`：无需改动（现有逻辑自动透传未知 kind）
- `apps/web/src/components/workbench/PendingQuestionCard.vue`：无需改动
- 不涉及后端 API、数据库结构、第三方依赖变更
