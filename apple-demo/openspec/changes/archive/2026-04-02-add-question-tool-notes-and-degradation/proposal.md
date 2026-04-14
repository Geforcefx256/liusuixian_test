## Why

`local:question` 目前对结构化 `select` 提问依赖严格的 `options` 数组格式。一旦模型把选项生成为无效字符串，运行时虽然会报出明确错误，但最终只能退化到普通文本收集，既丢失了原始提问上下文，也让用户不知道应该如何继续回答。

同时，当前 `select` 问题缺少统一的补充说明通道，用户只能在选项中二选一，无法在不破坏主答案语义的前提下补充特殊情况和备注。

## What Changes

- 为所有 `select` 类型问题增加一个统一的、独立的可选 `notes` 补充字段。
- 明确 `select` 的主答案语义与 `notes` 的补充说明语义，避免自由文本覆盖结构化选项。
- 在 `local:question` 结构化参数无效时，引入显式降级问题卡片，而不是直接退化为普通 assistant 文本。
- 降级问题卡片保留原始 `prompt`、错误原因，以及从坏参数中可提取的参考选项文本，帮助用户继续回答。
- 仅对可证明无损的 `options` 字符串数组做显式规范化，并记录告警；不对模糊输入做静默猜测修复。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 修改问题工具的交互契约、校验后的恢复策略，以及结构化提问失败时的显式降级行为。
- `agent-web-workbench`: 修改待处理问题卡片的渲染与提交行为，为 `select` 问题提供统一的 `notes` 字段，并展示降级问题卡片中的参考上下文。

## Impact

- Affected code: `apps/agent-backend` question contract, interaction payload/building, validation and failure recovery; `apps/web` pending question card and workbench interaction handling.
- APIs/protocols: session interaction payload for question cards will add a stable `notes` field for `select` questions and a degraded question mode carrying extracted reference context.
- Dependencies: no new third-party dependencies are required.
