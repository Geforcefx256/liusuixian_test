## Why

当前工作台在上传文件命中同名路径冲突时，仍直接调用浏览器原生 `window.confirm`。该黑色系统弹框与 workbench 已有的浅色确认层、按钮体系和上下文视觉不一致，也让上传确认逻辑继续停留在 store 直接触发浏览器交互的耦合模式中。

## What Changes

- 将工作台上传同名文件时的覆盖确认，从浏览器原生 `window.confirm` 切换为 workbench 内部的产品化确认弹层。
- 复用现有 workbench 确认层的视觉 token、遮罩层级与按钮体系，使上传覆盖确认与历史会话删除/清空等确认交互保持一致。
- 在确认内容中显式展示冲突文件路径与覆盖后果，提供清晰的取消与确认覆盖操作。
- 调整相关前端状态管理与测试，确保新确认流程只影响上传覆盖链路，不改变其他工作台确认交互和 API 契约。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 工作台上传文件命中同名路径冲突时，确认流程从浏览器原生确认框切换为产品内确认弹层，并要求展示冲突文件上下文与明确的覆盖动作。

## Impact

- Affected code:
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/components/workbench/WorkbenchShell.vue`
  - existing workbench confirmation component(s) and related frontend tests
- APIs:
  - 不修改现有文件上传 API 与冲突错误契约
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - 工作台上传流程、前端确认交互、相关测试覆盖
