## Why

当前模型 timeout 语义存在双重来源和遗留字段混用问题。`streamFirstByteTimeoutMs` / `streamIdleTimeoutMs` 已经表达了运行时真实需要的两段式 watchdog 语义，但 `requestTimeoutMs` 仍作为遗留回退字段存在，且模型 timeout 还允许被环境变量静默覆盖，导致配置排查成本高、行为不透明，并直接引发“修改 config.json 看起来未生效”的调试困惑。

## What Changes

- 删除模型配置中的遗留字段 `requestTimeoutMs`，统一只保留 `streamFirstByteTimeoutMs` 与 `streamIdleTimeoutMs`。
- **BREAKING** 删除 `AGENT_MODEL_REQUEST_TIMEOUT_MS`、`AGENT_MODEL_STREAM_FIRST_BYTE_TIMEOUT_MS`、`AGENT_MODEL_STREAM_IDLE_TIMEOUT_MS` 对模型 timeout 的环境变量覆盖能力。
- 明确运行时模型 timeout 只从 `apps/agent-backend/config.json` 加载，不再存在隐式优先级覆盖。
- 更新运行时说明、类型与校验逻辑，使首包超时和流式空闲超时的语义与配置面一致。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-backend-runtime`: 调整模型流式超时配置要求，要求运行时仅从 `config.json` 读取 `streamFirstByteTimeoutMs` 与 `streamIdleTimeoutMs`，并移除 `requestTimeoutMs` 与相关环境变量覆盖语义。

## Impact

- 影响 `apps/agent-backend` 的配置加载、模型配置类型、runtime 元数据暴露与相关测试。
- 影响 `apps/agent-backend/config.json`、README 与任何引用模型 timeout 字段的开发文档。
- 不引入新依赖，不改变流式 watchdog 的两阶段行为，只收敛配置来源和字段集合。
