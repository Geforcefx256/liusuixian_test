## Why

当前 workbench 对话输入区在运行中同时展示危险态“停止”和一个被禁用的“发送”按钮，即使输入框本身已经被锁定，仍然会向用户暴露一个不可执行的主动作，增加认知噪音。现在需要把输入区动作表达收敛为单一主动作位，并用更紧凑的图标交互替代文字按钮，统一运行态与空闲态的视觉语义。

## What Changes

- 将对话输入区右侧主动作改为同一位置切换，而不是并列展示“停止”和禁用的“发送”。
- 在空闲态使用图标化发送动作，在运行态切换为图标化停止动作，在停止请求中展示明确的 pending 状态。
- 删除输入区底部关于停止副作用的固定说明文案，避免在高频输入区域持续占用注意力。
- 保持现有运行、取消、停止请求中的后端语义与 store 状态机不变，仅调整前端表现和相关测试。
- 为图标按钮补齐可访问名称、焦点态和禁用态要求，确保键盘与读屏可用。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 调整对话输入区主动作的呈现规则，使其在空闲、运行和停止请求中使用单一动作位和图标化状态表达。

## Impact

- Affected code: `apps/web/src/components/workbench/ConversationPane.vue`
- Affected tests: `apps/web/src/components/workbench/ConversationPane.test.ts`
- Affected behavior: workbench 对话输入区主动作、停止中的视觉反馈、相关可访问性语义
- No API, dependency, or top-level directory changes
