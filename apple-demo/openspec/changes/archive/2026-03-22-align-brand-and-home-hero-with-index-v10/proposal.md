## Why

当前 `apps/web` 虽然沿用了 `index-v10.html` 的整体工作台结构，但左上品牌区和首页 Agent hero 仍然更像通用后台卡片：品牌块边界偏重、品牌文案层级不对、首页头部的图标也没有复用 `index-v10` 的 `icon-svg` 语言。现在先把截图中这两块明显割裂的视觉对齐，可以用很小的改动恢复产品一致性，并减少首页进入工作台时的“不是同一个产品”的感受。

## What Changes

- 调整 `WorkbenchShell` 顶部左侧品牌区的图形、文字层级、边界与留白，使其更接近 `index-v10.html` 的 `logo-icon` 区而不是独立卡片，并移除“核心网智能配置工作台”副标题。
- 调整 `HomeStage` 首页 Agent hero 的图标、标题、副标题、容器间距与对齐方式，使其收敛到 `index-v10.html` 的 home-stage header 表达，并移除“在线”状态文案。
- 将品牌区图标和首页 Agent 图标统一切换为 `index-v10.html` 使用的 `icon-svg` 语言，而不是继续使用当前自定义 glyph。
- 将这两块共享的 Agent / 品牌视觉语义继续沉淀到全局样式层，避免 header 与首页 hero 再次各自漂移。
- 保持现有工作台信息架构、会话流程、后端契约、技能治理入口与右侧上下文行为不变，不新增交互能力或新的页面状态。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: refine the workbench brand header and home-stage Agent hero requirements so they visually align with `index-v10.html` while keeping the existing phase 1 behavior and backend-driven metadata flow unchanged.

## Impact

- Affected code: `apps/web/src/styles.css`, `apps/web/src/components/workbench/WorkbenchShell.vue`, `apps/web/src/components/workbench/HomeStage.vue`
- Unchanged systems: `apps/web/src/stores/workbenchStore.ts`, `ConversationPane.vue`, `WorkspaceContextPane.vue`, `/agent/api/*`, `/web/api/auth/*`
- UX impact: the first screen of the workbench will present the same brand and Agent icon language as `index-v10`, without the extra brand subtitle or home-stage online badge
