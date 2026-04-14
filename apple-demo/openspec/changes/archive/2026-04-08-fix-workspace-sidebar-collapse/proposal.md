## Why

当前 workbench 右侧工作空间侧栏在规范上要求支持手动折叠与重新展开，但前端实现只更新了折叠状态，没有把该状态落实为真实的布局隐藏，导致用户点击收起按钮后视觉上几乎没有变化。与此同时，侧栏顶部和整体宽度策略仍然偏桌面固定宽度，在受限宽度下会出现拥挤、按钮悬空和信息层级不清的问题，因此需要一次行为与视觉同时收口的修正。

## What Changes

- 修正 workspace-expanded 状态下右侧工作空间侧栏的手动折叠行为，使“收起”和“展开”都成为真实可见的布局切换，而不是仅更新内部状态。
- 收敛侧栏折叠、自动折叠、手动重新展开三种状态之间的优先级，保证受限宽度下仍能保留用户可预期的手动控制。
- 调整右侧侧栏顶部 chrome 与受限宽度表现，避免“工作空间 / 模板”分段控件、收起按钮和固定宽度策略在窄尺寸下产生拥挤和临时拼接感。
- 补齐前端测试，覆盖手动折叠、重新展开、受限宽度自动折叠以及已展开文件不因侧栏折叠而关闭等行为。

## Capabilities

### New Capabilities

### Modified Capabilities
- `agent-web-workbench`: 修正工作空间侧栏在 workspace-expanded 状态下的手动折叠/重新展开行为，并明确受限宽度下的侧栏可见性与顶部布局要求。

## Impact

- Affected frontend shell and sidebar code in `apps/web/src/components/workbench/WorkbenchShell.vue` and `apps/web/src/components/workbench/WorkspaceSidebar.vue`
- Affected shared workbench styles in `apps/web/src/styles.css` when segmented controls or compact sidebar chrome need responsive tuning
- Affected frontend tests around shell layout and sidebar interactions in `apps/web/src/components/workbench/*.test.ts`
- No top-level directory changes and no new third-party dependencies are required
