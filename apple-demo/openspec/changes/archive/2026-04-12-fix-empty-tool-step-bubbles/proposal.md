## Why

当 agent 执行连续工具调用后未产生文本回复时（中断、超时、会话结束等场景），多条 `kind: 'tool-step'` 消息因不满足分组条件而退化为独立 `MessageDisplayItem`，而 `ConversationPane.vue` 渲染层没有 `tool-step` 分支，导致这些消息以空气泡形式显示在界面上，影响用户体验。

## What Changes

- 修改会话展示分组逻辑（`conversationDisplay.ts`）：当纯 `tool-step` 序列无尾随 `text` 消息时，将其合并为 `ToolStepGroupDisplayItem` 而非退化为独立消息项
- 修改会话渲染层（`ConversationPane.vue`）：为 `tool-step-group` 新增渲染分支显示工具步骤卡片，同时为漏出的独立 `tool-step` 添加兜底渲染分支
- 更新现有 spec 中"Segment ending with tool-step does not form a process group"场景的行为定义，从"各自独立渲染"改为"合并为工具步骤组"

## Capabilities

### New Capabilities

_无新增能力_

### Modified Capabilities

- `agent-web-workbench`: 修改"Segment ending with tool-step does not form a process group"场景的行为要求——纯 tool-step 序列不再退化为独立空气泡，而是合并为工具步骤组显示工具名称

## Impact

- `apps/web/src/components/workbench/conversationDisplay.ts`：新增 `ToolStepGroupDisplayItem` 类型，修改分组 fallback 逻辑
- `apps/web/src/components/workbench/conversationDisplay.test.ts`：更新/新增测试用例
- `apps/web/src/components/workbench/ConversationPane.vue`：新增 `tool-step-group` 和 `tool-step` 渲染分支及样式
- `apps/web/src/stores/workbenchStore.ts`：`ToolStepGroupDisplayItem` 类型导出（如需）
- 无新增第三方依赖，无 API 变更，无后端改动
