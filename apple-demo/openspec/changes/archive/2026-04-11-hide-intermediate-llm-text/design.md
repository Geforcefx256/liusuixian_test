## Context

Agent 对话的多步执行由 `AgentLoop.run()` 驱动。每次 LLM 返回 tool_call 时，agentLoop 会保存一条包含 text + tool parts 的 assistant 消息（`agentLoop.ts:142`），然后继续循环。只有 LLM 不再调用工具时，才保存最终的纯文本 assistant 消息（`agentLoop.ts:80`）并退出循环。

这些中间消息的 text 部分是 LLM 的自言自语（如"让我检查一下 uploads 目录"），在前端通过 `buildConversationDisplayItems` 分组后显示在"查看过程（N）"里，对用户没有价值。

当前系统已有 message attributes 机制：`AgentSessionSkillContextMessageAttributes`（`visibility: 'hidden'`, `semantic: 'skill-context'`）用于标记对用户不可见的 skill 上下文消息。但该机制的序列化/反序列化硬编码只认一种 attributes 格式。

displayName 解析链路已存在：`config.json` 中配置的 `runtime.tools.displayNames` 通过 `createToolDisplayNameResolver` 创建解析器，在 `AgentService` 构造时注入 `AgentLoop`，目前仅传递给 `AgentLoopToolRunner` 用于 `tool.started` 事件。

## Goals / Non-Goals

**Goals:**

- 中间步骤消息在 UI 中显示工具调用的友好名称摘要，替代 LLM 自言自语文本
- LLM 的对话历史不受任何影响（`listMessages` 返回完整消息，中间消息的 parts 不变）
- 复用现有 attributes 机制，扩展而非替换
- 只标记 agentLoop 中明确的中间步骤（`continue` 路径），不影响最终消息和 shortCircuit 消息

**Non-Goals:**

- 不改变 `tool.started` 事件的实时 header 展示行为
- 不改变 LLM 可见的对话上下文内容
- 不修改 sessionStore 接口签名（不向 `getSessionMessagesView` 注入 displayNameResolver）
- 不处理 planner 子循环（`plannerLoop.ts`）的中间消息——当前 planner 不通过 `AgentLoop` 保存消息

## Decisions

### D1: visibility 使用 `'internal'` 而非 `'hidden'`

**决策**：中间消息的 `visibility` 设为 `'internal'`。

**理由**：`'hidden'` 会被 `isHiddenSessionMessage` 命中，导致 `buildMessageView` 返回 null，消息从 UI 完全消失。中间消息需要在 UI 中以工具摘要形式展示，不应被完全隐藏。`'internal'` 表示"对 LLM 内部可见，对用户需降级展示"。

**替代方案**：使用 `'hidden'` + 在 `buildMessageView` 中添加特殊分支跳过 hidden 检查 → 破坏 hidden 语义的一致性，拒绝。

### D2: displayName 在写入时解析并存入 attributes

**决策**：在 `agentLoop.ts:142` 保存中间消息时，通过 `displayNameResolver` 将 tool parts 中的 `name` 解析为 displayName，存入 `attributes.toolDisplayNames` 数组。

**理由**：
- 不需要改动 `sessionStore` 接口签名（无需注入 resolver）
- 历史准确——displayName 冻结为执行时刻的配置值
- `AgentLoop` 构造函数已接收 `displayNameResolver`（当前只传给 `toolRunner`），只需自身也持有引用

**替代方案**：在 `buildMessageView` 读取时动态解析 → 需要改 `sessionStore` 接口、影响测试和 mock，拒绝。

### D3: View 层返回 `kind: 'tool-step'`

**决策**：`buildMessageView` 对 intermediate 消息返回 `kind: 'tool-step'`，携带 `toolDisplayNames: string[]`，`text` 设为空字符串。

**理由**：与 `'protocol'`、`'result'` 一致的模式——不同类型的消息用不同 kind + 专属字段。前端可以据此选择完全不同的渲染组件。

### D4: `appendAssistantMessage` 签名改为 options 对象

**决策**：将第三参数从 `createdAt = Date.now()` 改为 `options?: { createdAt?: number; attributes?: AgentSessionMessageAttributes }`。

**理由**：当前第三参数 `createdAt` 是可选的默认参数，几乎所有调用点都不传。改为 options 对象可以同时支持 `createdAt` 和 `attributes`，且不传时行为不变。三个调用点（Line 80、125、142）中只有 142 需要传 attributes。

### D5: 前端分组策略——tool-step 参与分组但不能作为 mainMessage

**决策**：`conversationDisplay.ts` 中 `isCompletedAssistantTextMessage` 扩展为同时接受 `kind: 'tool-step'`。`collectCompletedAssistantSegment` 收集连续的 text + tool-step 消息。分组时最后一条消息必须是 `kind: 'text'` 才作为 `mainMessage`；如果最后一条是 `tool-step`（异常情况），不分组而是各自独立展示。

**理由**：mainMessage 是用户最终看到的回答，必须是 text 类型。tool-step 只能作为 collapsedSteps 的一部分。

### D6: 渲染粒度——每个工具一行

**决策**：在 `AssistantProcessGroup.vue` 中，对 `tool-step` 类型的 collapsedStep，遍历其 `toolDisplayNames` 数组，每个 displayName 渲染为独立一行（`○ 读取工作区文件`）。同一 step 消息内的多个工具展开为多行。

**理由**：用户关心的是 agent 调用了哪些工具，按工具粒度展示信息密度最高。step 粒度的分组通过 DOM 结构自然保留（同一 step 的工具行在同一容器内）。

## Risks / Trade-offs

- **已有数据无标记**：历史会话中的中间消息没有 `intermediate` attributes，仍会以旧方式展示 LLM 文本 → 可接受，不做数据迁移，旧数据保持原样
- **parseMessageAttributes 硬编码扩展**：当前解析函数是白名单式的，每新增一种 attributes 都要加分支 → 短期可接受，如果未来 attributes 类型继续增多，可重构为注册式解析
- **displayName 配置变更后历史不一致**：如果 `config.json` 中的 displayNames 被修改，新消息和旧消息可能显示不同的友好名 → 可接受，与 `tool.started` 事件的行为一致（也是执行时解析）
