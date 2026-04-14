## Why

Agent 多步执行时，agentLoop 的每次中间迭代会保存一条 assistant 消息，包含 LLM 的自言自语文本（如"让我检查一下 uploads 目录"）和 tool parts。这些中间消息在前端通过"查看过程（N）"展示给用户，但文本内容对用户无意义，降低了对话的信噪比。需要将中间步骤的展示从 LLM 文本替换为工具调用摘要，让用户看到 agent 做了什么而非它在"想"什么。

## What Changes

- 后端中间消息标记：在 agentLoop 保存中间 assistant 消息时，通过 message attributes 标记为 `intermediate`，同时将工具的友好显示名（displayName）写入 attributes
- 后端 View 层转换：`buildMessageView` 识别 intermediate 消息后，返回 `kind: 'tool-step'` 并携带 `toolDisplayNames` 数组，丢弃 LLM 自言自语文本
- attributes 解析扩展：`parseMessageAttributes` 从仅支持 `skill-context` 扩展为同时支持 `intermediate` 类型
- 前端消息类型扩展：新增 `UiToolStepMessage` 类型，`mapPersistedMessage` 处理 `tool-step` kind
- 前端分组逻辑适配：`conversationDisplay.ts` 的分组判断条件扩展为同时接受 `text` 和 `tool-step` 消息
- 前端渲染替换：`AssistantProcessGroup.vue` 中 `collapsedSteps` 对 `tool-step` 类型按每个工具一行显示友好名称，替代原来的完整 LLM 文本

## Capabilities

### New Capabilities

- `intermediate-step-display`: 覆盖中间步骤消息的标记、View 层转换、前端类型映射和渲染逻辑

### Modified Capabilities

- `agent-web-workbench`: 对话消息分组逻辑（`conversationDisplay.ts`）和过程展示组件（`AssistantProcessGroup.vue`）的渲染行为变更

## Impact

- 后端类型层：`sessionStoreTypes.ts` — attributes 联合类型扩展，view kind 扩展
- 后端消息识别：`sessionMessages.ts` — 新增 intermediate 判断与工厂函数
- 后端序列化：`sessionStoreUtils.ts` — `parseMessageAttributes` 扩展
- 后端执行层：`agentLoop.ts` — `appendAssistantMessage` 签名扩展，中间消息写入 attributes
- 后端 View 层：`sessionStore.ts` — `buildMessageView` 新增 intermediate 分支
- 前端 API 类型：`api/types.ts` — view 类型扩展
- 前端 Store：`workbenchStore.ts` — 新增 `UiToolStepMessage`，扩展消息映射
- 前端展示：`conversationDisplay.ts`、`AssistantProcessGroup.vue` — 分组与渲染逻辑
- 不引入新的第三方依赖
- 不影响 LLM 对话历史（`listMessages` 不过滤 `internal` visibility）
- 不影响 `filterReplayMessages`（只检查 tool parts 的 awaiting-interaction 标记）
