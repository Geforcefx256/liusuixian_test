## Why

当前“历史会话”里的单条删除和批量清空仍依赖浏览器原生确认框，交互样式与 workbench 已有的产品化视觉和上下文操作方式脱节。既然会话历史已经沉淀为侧栏内的高频管理入口，现在需要把危险操作确认收敛为产品内一致的轻量确认体验，让删除行为更接近 ChatGPT/OpenAI 的侧栏心智，同时保留明确的风险提示。

## What Changes

- 将历史会话的单条删除确认从浏览器原生 `window.confirm` 改为贴近会话项的轻量确认浮层，保留会话标题上下文，并将危险动作主文案统一为“删除会话”。
- 将“清空历史会话”的确认从浏览器原生 `window.confirm` 改为同一套产品内确认样式下的更正式确认框，明确说明当前会话不受影响。
- 统一历史会话危险操作的视觉层级、按钮样式、键盘关闭语义和点击外部关闭语义，避免原生浏览器框与现有 workbench token/按钮体系并存。
- 更新相关前端组件与测试，覆盖轻量确认浮层、正式确认框、取消/确认路径以及焦点与关闭行为。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 历史会话的删除确认与清空确认从浏览器原生确认框切换为 OpenAI 风格的产品内确认交互，并细化两类危险操作的层级与上下文反馈要求。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/SessionRail.vue`
  - related frontend tests
  - shared frontend styles or local workbench styles if confirmation surfaces are extracted
- APIs:
  - 不修改现有会话删除与清空历史 API 契约
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - 历史会话侧栏交互、危险操作确认流程、前端焦点与关闭行为测试
