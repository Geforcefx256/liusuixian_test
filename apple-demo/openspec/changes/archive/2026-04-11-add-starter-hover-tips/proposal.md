## Why

当前空会话工作台中的快速开始技能卡只展示受限的摘要文本，长一些的 `用户可见描述` 无法被用户完整浏览，导致用户在真正点击“开始使用”前难以判断该技能是否适合当前任务。现有卡片布局已经偏信息密集，如果直接放开卡片高度，会削弱三列卡片的扫描效率和整体稳定性。

## What Changes

- 在空会话工作台的快速开始技能卡中，为已展开技能增加显式的 `i` 信息入口，仅在桌面端通过悬浮 `i` 展示补充说明卡。
- 将悬浮说明卡的内容固定为技能标题与快速开始摘要，不在说明卡内承载新的执行按钮、滚动容器或长文本内部滚动行为。
- 将 `i` 信息按钮放在展开态操作行中，与左侧的“开始使用”形成对称布局。
- 将说明卡的桌面端放置规则固定为：左列向右展开，中列向下展开，右列向左展开，先以稳定规则落地，不引入复杂自动避让。
- 为说明卡定义明确的显示上限：标题单行，正文最多 6 行，超出截断，不滚动。
- 补充工作台交互与样式验证，确保 `i` 为唯一悬浮触发点，并保留现有“开始使用”主操作位置。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 调整空会话快速开始技能卡的信息披露方式，为已展开技能增加桌面端 `i` 悬浮说明卡，使用快速开始摘要作为提示内容，并固定说明卡放置与文本展示边界。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/ConversationPane.vue`
  - `apps/web/src/stores/workbenchStore.ts`
  - related tests under `apps/web/src/components/workbench/**` and `apps/web/src/stores/**`
- Affected runtime surfaces:
  - empty conversation shell starter cards
  - governed starter skill description disclosure in the workbench
- No new top-level directories and no new third-party dependencies are intended in this change.
