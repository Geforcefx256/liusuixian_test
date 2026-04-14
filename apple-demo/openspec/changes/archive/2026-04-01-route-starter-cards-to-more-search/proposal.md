## Why

当前空会话中的“常用起点”卡片点击后会把固定模板句写入输入框，这会把“选择能力方向”和“开始撰写任务”混在一起。用户此时通常只是想进入某个技能类别继续挑选，而不是立即接受一段缺少任务上下文的预填文本。

现在需要把 starter 卡片的点击语义收敛为“进入对应技能发现上下文”，让用户先在“更多搜索”中确认具体 skill，再自行描述任务。

## What Changes

- 将空会话“常用起点”卡片的点击行为从预填输入框改为联动“更多搜索”区域。
- 点击 starter 卡片后自动展开“更多搜索”，并按对应 intent group 聚焦结果。
- 保持搜索输入框为空，不再自动写入“请帮我使用……”类模板文本。
- 在“更多搜索”中突出当前代表 starter skill，并同时保留同类技能的可比较性。
- 为 starter 与搜索联动补充前端状态与组件测试，确保聊天页和相关发现入口行为一致。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: 调整空会话 starter 卡片与“更多搜索”之间的联动语义，要求点击 starter 后进入对应的技能发现上下文，而不是预填输入框正文。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/ConversationPane.vue`
  - `apps/web/src/components/workbench/ConversationPane.test.ts`
  - `apps/web/src/stores/workbenchStore.ts`
  - related workbench search / starter tests
- Affected systems:
  - workbench empty conversation starter interaction
  - governed skill discovery flow in the conversation shell
- No top-level directory changes.
- No new third-party dependencies are required.
