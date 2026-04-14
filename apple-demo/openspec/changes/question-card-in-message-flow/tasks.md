## 1. 类型定义

- [x] 1.1 在 `apps/web/src/stores/workbenchStore.ts` 中新增 `UiQuestionMessage` 接口（kind: 'question', role: 'assistant', status: 'done', interaction: AgentSessionInteraction）
- [x] 1.2 将 `UiQuestionMessage` 加入 `UiMessage` union type

## 2. Store 层：注入与移除逻辑

- [x] 2.1 新增辅助函数 `buildQuestionMessage(interaction)`，将 `AgentSessionInteraction` 转为 `UiQuestionMessage`
- [x] 2.2 修改 `setSessionInteractions`：pending interaction 存在时，在 messages[] 末尾 upsert `UiQuestionMessage`；不存在时从 messages[] 移除（按 id 过滤）
- [x] 2.3 修改 `buildHydratedSessionMessages`：返回前检查 `pendingInteraction`，存在则 append `UiQuestionMessage` 到消息列表末尾

## 3. 渲染层：ConversationPane.vue

- [x] 3.1 在消息列表渲染循环中，新增 `item.message.kind === 'question'` 分支，渲染 `PendingQuestionCard`
- [x] 3.2 移除 composer 区的 `v-if="pendingInteraction"` 渲染块（PendingQuestionCard 及其事件绑定）

## 4. 验证

- [x] 4.1 触发 `local:question` 工具调用，确认卡片出现在消息流末尾并自动滚动到底部
- [x] 4.2 卡片字段较多时，确认消息区滚轮正常工作
- [x] 4.3 提交/拒绝问题后，确认卡片消失并显示摘要文本，composer 恢复正常输入
- [x] 4.4 切换历史会话再切回，确认 pending 卡片正确还原，已回答的显示摘要
- [x] 4.5 运行 `pnpm type-check` 确认无类型错误
