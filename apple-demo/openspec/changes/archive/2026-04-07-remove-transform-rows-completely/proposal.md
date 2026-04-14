## Why

`transform_rows` 已经不再是当前产品希望保留的 runtime 工具，但仓库中仍残留配置默认值、类型建模、执行回退逻辑、deny 配置和测试语义。这种“表面隐藏、底层仍承认存在”的状态会继续制造误导，也让后续排障无法判断它到底是已删除还是可被旁路恢复。

## What Changes

- 从 `apps/agent-backend` 的 gateway 与 MCP 配置文件中移除 `transform_rows` 相关默认配置，不再保留 `defaultTool: "transform_rows"` 之类的交付残留。
- **BREAKING** 从 gateway / MCP 运行时配置类型与解析逻辑中移除对 `transform_rows` 作为默认工具的隐式语义，不再允许通过默认值或空缺字段恢复该工具。
- **BREAKING** 调整 MCP 执行链路，缺少明确 `tool` 标识时必须显式失败，而不是回退到已删除的默认工具。
- 清理 runtime deny 中针对 `transform_rows` 的历史屏蔽项，避免配置继续承认已被彻底删除的工具。
- 更新相关测试、样例工具名和断言，确保仓库中不再把 `transform_rows` 当作有效工具或示例基线。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-backend-runtime`: runtime 工具配置与执行约束需要改为彻底删除 `transform_rows`，并禁止通过默认值、回退或残留配置重新暴露该工具。

## Impact

- Affected code: `apps/agent-backend/src/gateway/**`, `apps/agent-backend/src/mcp/**`, `apps/agent-backend/src/runtime/tools/**`, `apps/agent-backend/config.json`, `apps/agent-backend/gateway.config.json`, `apps/agent-backend/mcp.config.json`
- Affected behavior: gateway/MCP runtime 配置加载、catalog 暴露、MCP 调用参数校验、tool deny 语义、backend 测试基线
- No new dependencies and no top-level directory changes
