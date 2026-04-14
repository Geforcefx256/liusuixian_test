## Why

当前 workbench 右侧“工作空间”文件侧栏在文件数量较多时会失去稳定的纵向滚动能力，导致用户无法继续下拉查看完整文件列表，也无法通过正常滚轮或触控板滚动访问后续文件。这个问题已经直接阻断高文件量工作区的核心浏览路径，需要把侧栏恢复为可预期、可持续滚动的工作区视图。

## What Changes

- 修正工作空间右侧侧栏的布局高度链和滚动容器归属，确保文件列表在长内容场景下始终由单一纵向滚动容器承载。
- 调整工作台壳层与侧栏面板的 `flex`、`min-height` 和 `overflow` 关系，消除多层容器之间互相抢占滚动或截断滚动区域的问题。
- 收敛文件树内部的滚动职责，避免组容器和面板容器同时承担纵向滚动，提升长列表滚动稳定性。
- 更新相关前端测试，覆盖工作空间侧栏长列表时的滚动容器行为，避免同类回归。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 工作空间侧栏在文件数量较多时必须持续支持稳定的纵向滚动，并保持文件树可访问性，不得因布局容器嵌套导致文件列表被截断或无法滚动。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/WorkspaceSidebar.vue`
  - `apps/web/src/components/workbench/WorkbenchShell.vue`
  - related workbench frontend tests
- APIs:
  - 不修改现有工作空间文件读取、上传或打开 API 契约
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - workbench 右侧工作空间侧栏布局
  - 文件树长列表滚动行为
  - 前端样式与回归测试
