## Why

当前空会话中"快速开始"卡片与"更多搜索"之间存在强耦合：点击快速开始卡片会自动展开更多搜索面板、设置 discovery context、按分组过滤搜索结果，并在搜索区域显示"来自常用起点"提示。这导致两个问题：

1. 用户点击快速开始时期望的是快速选中一个 skill 并开始，却被引导到一个与自己意图无关的搜索界面。
2. 更多搜索的结果被快速开始的分组过滤污染，失去了作为独立搜索工具的价值。

需要将两个区域解耦：快速开始回归"选中 → 确认 → 开始"的轻量流程，更多搜索回归独立的全局搜索功能。

## What Changes

- 移除 `skillDiscoveryContext` 状态及其关联的 discovery 过滤、代表 skill 置顶逻辑。
- 快速开始卡片改为两步操作：点击 skill 名称 → 展开描述 + "开始使用"链接 → 点击"开始使用"发送 starterPrompt。
- 更多搜索默认展开，独立运作，不受快速开始操作影响。
- 全局只允许一个 skill 处于展开/选中态（跨卡片、跨区域互斥）。
- 更多搜索默认只展示热门技能 chip，不再展示全量技能列表。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: 重构空会话快速开始与更多搜索的交互模型，将两者解耦为独立运作的区域，快速开始采用两步确认选中的交互模式。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/ConversationPane.vue`
  - `apps/web/src/components/workbench/ConversationPane.test.ts`
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/stores/workbenchStore.test.ts`
  - `apps/web/src/components/workbench/WorkbenchShell.vue`
- Affected systems:
  - workbench empty conversation starter interaction
  - governed skill search and discovery flow
- No top-level directory changes.
- No new third-party dependencies are required.
- Supersedes change `route-starter-cards-to-more-search`.
