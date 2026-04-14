## Why

最近将历史会话危险操作从浏览器原生确认框切换为产品内确认层后，`清空历史会话` 在真实鼠标点击路径下出现了交互回归：菜单项可见且可用，但点击后只会收起菜单，不会打开确认框，也不会发出批量清空请求。这个问题直接破坏了现有历史管理能力，而且单测未覆盖真实事件顺序，导致回归没有被及时发现。

## What Changes

- 修复历史会话侧栏中 `更多操作 -> 清空历史会话` 在真实鼠标点击下无法打开确认框的问题。
- 收敛历史侧栏内菜单、确认层和展开面板之间的事件与焦点语义，避免在 `pointerdown`、`focusout`、关闭逻辑之间出现竞态，导致菜单项在 `click` 前失活。
- 为批量清空交互补上能覆盖真实菜单点击路径的前端测试，确保确认框打开、取消关闭和确认后发请求的行为稳定可回归验证。
- 保持单条删除、Esc 关闭、点击外部关闭和批量清空 API 契约不变，只修复交互行为回归。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-web-workbench`: 历史会话侧栏中的批量清空入口必须在真实用户点击下稳定打开确认框，并保持菜单与确认层的焦点/关闭语义一致。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/SessionRail.vue`
  - related workbench frontend tests
- APIs:
  - 不修改现有批量清空历史 API 契约
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - 历史会话侧栏菜单交互、确认层状态管理、前端事件顺序测试
