## Context

工作台对话界面（`ConversationPane.vue`）由两个布局区域组成：

- **Row 1**（`minmax(0, 1fr)`）：消息列表区，`overflow-y: auto`，是唯一的可滚动容器
- **Row 2**（`auto`）：composer 区，高度自适应，不参与滚动

`PendingQuestionCard` 当前渲染在 Row 2（composer 区），`pendingInteraction` 作为独立 prop 传入，与 `messages[]` 是两条独立数据流。

autoScroll 机制（`useConversationAutoScroll`）通过 watch `messages[]` 驱动，对 `pendingInteraction` 的变化无感知。

## Goals / Non-Goals

**Goals:**
- 问题卡片进入 Row 1（消息流），滚轮在任何内容长度下均正常工作
- 卡片出现时自动滚到底部，用户无需手动查找
- 历史加载后 pending 卡片正确还原到消息流末尾
- 已回答/拒绝的卡片历史展示方式不变（保持"已提交回答：..."摘要）

**Non-Goals:**
- 不改变后端 API 或数据库结构
- 不支持多个并发 pending interaction（当前业务无此需求）
- 不改变已回答卡片的视觉形态（方案 B 摘要，不还原卡片）

## Decisions

### 决策 1：将 pendingInteraction 注入 messages[]（方案 B）

**选择**：在前端内存层新增 `UiQuestionMessage` 类型，将 interaction merge 进 `messages[]`，而非仅在模板层 append。

**理由**：
- autoScroll watch `messages[]` 变化，注入后自动触发滚动，无需手动补 watch
- 历史加载（`buildHydratedSessionMessages`）统一处理，不需要单独处理 pending 卡片的滚动
- 长期维护单一数据流，消除 messages 和 pendingInteraction 永远两路的补丁模式

**放弃方案 A（模板层 append）的原因**：需要手动 watch `pendingInteraction` 触发 autoScroll、历史加载后单独处理滚动，相当于为独立数据流持续打补丁。

### 决策 2：UiQuestionMessage 的 id 使用 interactionId

**选择**：`id = interaction.interactionId`

**理由**：保证唯一性，支持 upsert 语义（`setSessionInteractions` 多次调用时幂等）。

### 决策 3：conversationDisplay.ts 不修改

**选择**：`buildConversationDisplayItems` 中 `kind === 'question'` 不满足 `isCompletedAssistantTextMessage` 条件，自动走普通 `MessageDisplayItem` 分支。

**理由**：问题卡片不需要参与 assistant-process 折叠逻辑，透传为普通 item 即可。无需引入新的 display item 类型。

### 决策 4：已回答卡片的历史展示不变

**选择**：interaction answered/rejected 后，从 `messages[]` 移除 `UiQuestionMessage`，历史摘要由现有 `questionHistorySummary.ts` 逻辑继续处理。

**理由**：`[INTERACTION CONTEXT]` → 摘要文本的管道已完整运作，无需改动。

## Risks / Trade-offs

- **[风险] `messages[]` 混入非持久化 item**：`UiQuestionMessage` 只存在于前端内存，不来自后端 API。如果其他地方对 messages[] 做遍历假设其均为持久消息，可能产生边界问题。→ 缓解：`UiQuestionMessage` 无 `messageId`，与持久消息可区分；历史加载时通过过滤 kind 保证干净。

- **[风险] setSessionInteractions 调用顺序**：`buildHydratedSessionMessages` 依赖 `resolvedQuestionInteractionLookup`，而该 lookup 由 `setSessionInteractions` 构建。两者调用顺序需保证 interactions 先于 messages hydrate。→ 现有 `reloadSessionState` 中已是 `setSessionInteractions` 先调用，顺序正确。
