## Why

当前对话气泡里的工具名直接由运行时工具 ID 归一化后展示，像 `skill:read_asset` 会显示成 `read_asset`，用户可读性较差，也不方便按产品语言持续调整。现在需要把工具展示名从硬编码推导改为运行时配置驱动，保证流式调用态和完成态汇总使用同一套用户可见名称。

## What Changes

- 在 `apps/agent-backend/config.json` 的运行时工具配置下新增 `tool -> displayName` 映射，用于定义用户可见的工具中文展示名。
- 后端在生成 `tool.started.displayName` 时优先使用配置中的展示名，而不是直接展示归一化后的原始工具 ID。
- runtime bootstrap 向前端下发展示名映射，供前端完成态头部汇总复用同一套名称。
- 前端对话气泡完成态汇总改为优先使用后端下发的展示名映射，避免 `正在调用` 与 `使用 Tools` 两处展示不一致。
- 首批为内建 `local:*` 和 `skill:*` 工具提供用户可读的中文展示名，包含 `skill:read_asset -> 读取技能文件` 与 `local:question -> 等待你回答`。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: runtime 配置与 bootstrap 元数据需要支持工具展示名映射，并将该映射用于流式工具调用展示。
- `agent-web-workbench`: 对话消息头部需要使用后端下发的工具展示名映射，统一流式态与完成态的工具名称展示。

## Impact

- Affected code: `apps/agent-backend/src/memory/ConfigLoader.ts`, runtime/bootstrap 相关模块、工具调用事件生成逻辑、`apps/web/src/stores/workbenchStore.ts`、前后端共享的 bootstrap 类型定义。
- APIs: runtime bootstrap 响应结构将增加工具展示名映射元数据。
- Dependencies: none.
- Systems: backend runtime configuration, workbench conversation headers, tool invocation display flow.
