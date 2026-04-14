## 1. 分组层：新增 ToolStepGroupDisplayItem 类型与分组逻辑

- [x] 1.1 在 `conversationDisplay.ts` 中新增 `ToolStepGroupDisplayItem` 接口（`kind: 'tool-step-group'`，`steps: UiToolStepMessage[]`），并将其加入 `ConversationDisplayItem` 联合类型
- [x] 1.2 修改 `buildConversationDisplayItems` 中序列末尾非 `text` 的 fallback 分支：当序列全部为 `tool-step` 时合并为 `ToolStepGroupDisplayItem`，混合序列保持原退化逻辑

## 2. 渲染层：新增 tool-step-group 和 tool-step 渲染分支

- [x] 2.1 在 `ConversationPane.vue` 模板中 `assistant-process` 分支之后新增 `item.kind === 'tool-step-group'` 分支，遍历 `steps` 渲染各工具的 `toolDisplayNames`
- [x] 2.2 在 `ConversationPane.vue` 模板的 `v-else` 之前新增 `item.message.kind === 'tool-step'` 兜底分支，渲染 `toolDisplayNames` 为行内工具名称
- [x] 2.3 添加 `.conversation-pane__tool-step-group` 和 `.conversation-pane__tool-step-line` 样式，复用 `AssistantProcessGroup` 中 `○ 工具名称` 的视觉风格

## 3. 测试

- [x] 3.1 更新 `conversationDisplay.test.ts`：修改现有 "segment ending with tool-step" 测试用例，验证纯 tool-step 序列产出 `tool-step-group` 类型
- [x] 3.2 新增 `conversationDisplay.test.ts` 测试用例：验证混合序列（text + tool-step 末尾）仍退化为独立 `MessageDisplayItem`
- [x] 3.3 新增 `conversationDisplay.test.ts` 测试用例：验证单条 tool-step 消息不产出 `tool-step-group`（保持为独立 `MessageDisplayItem`）
