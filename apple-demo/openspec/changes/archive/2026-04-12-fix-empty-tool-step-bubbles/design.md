## Context

工作台会话渲染分为两层：

1. **分组层**（`conversationDisplay.ts`）：将原始 `UiMessage[]` 转换为 `ConversationDisplayItem[]`，将连续的已完成 assistant 消息折叠为 `AssistantProcessDisplayItem`
2. **渲染层**（`ConversationPane.vue`）：根据 `ConversationDisplayItem` 的 `kind` 分发到对应的 Vue 模板分支

当前分组规则要求序列末尾必须是 `kind: 'text'` 才能形成 `assistant-process` 组。不满足时整个序列退化为独立 `MessageDisplayItem`。渲染层没有 `tool-step` 的独立分支，退化后的 `tool-step`（`text: ""`）落入 `v-else` 通用分支，渲染为空 `<p></p>`。

## Goals / Non-Goals

**Goals:**

- 消除纯 tool-step 序列在界面上显示为空气泡的问题
- 纯 tool-step 序列以紧凑的工具步骤卡片形式展示，显示各工具的 `toolDisplayNames`
- 任何场景下单独漏出的 `tool-step` 消息不再产生空气泡

**Non-Goals:**

- 不改变已有的 `assistant-process` 分组逻辑（tool-step + 尾随 text 的正常场景不受影响）
- 不修改后端消息生成逻辑
- 不改变 `tool-step` 消息的数据结构

## Decisions

### D1：新增 `ToolStepGroupDisplayItem` 类型

在 `conversationDisplay.ts` 中新增第三种 `ConversationDisplayItem`：

```
ConversationDisplayItem = MessageDisplayItem
                        | AssistantProcessDisplayItem
                        | ToolStepGroupDisplayItem     ← 新增
```

`ToolStepGroupDisplayItem` 持有 `steps: UiToolStepMessage[]`，代表一组无尾随文本的纯工具步骤。

**替代方案**：复用 `AssistantProcessDisplayItem` 让 `mainMessage` 可选。否决原因——`mainMessage` 是该类型的核心语义，改为可选会污染所有已有消费方的类型守卫。

### D2：分组层 fallback 分支拆分

原 fallback（序列末尾非 text）的行为改为：

| 条件 | 行为 |
|------|------|
| 序列全部是 `tool-step` | 合并为一个 `ToolStepGroupDisplayItem` |
| 混合序列（含 text 和 tool-step，但末尾是 tool-step） | 保持原退化逻辑，各自独立渲染 |

这样保证改动最小化，只处理最常见的纯 tool-step 场景。

### D3：渲染层双重防护

1. `ConversationPane.vue` 在 `item.kind === 'assistant-process'` 分支之后新增 `item.kind === 'tool-step-group'` 分支，渲染为工具步骤卡片
2. 在 `item.message.kind` 的 `v-if` 链中，`v-else` 之前新增 `item.message.kind === 'tool-step'` 兜底分支

两层防护确保即使分组层逻辑未覆盖的边缘场景，`tool-step` 也不会渲染为空气泡。

### D4：工具步骤卡片视觉风格

复用 `AssistantProcessGroup` 中已有的 `○ 工具名称` 行样式（`--text-secondary` 颜色、`--font-body` 字号），保持一致的视觉语言。不显示头像和时间戳，因为这些步骤是辅助信息而非独立对话。

## Risks / Trade-offs

- **[混合序列仍然退化]** → 混合序列（text + tool-step 但末尾是 tool-step）仍按独立消息渲染。但渲染层兜底分支（D3.2）确保即使这种情况也不会出现空气泡，text 消息正常渲染，tool-step 显示工具名称。
- **[分组类型增加]** → `ConversationDisplayItem` 从 2 种变为 3 种，`ConversationPane.vue` 模板分支增加。复杂度增量很小，且类型系统保证了穷尽检查。
