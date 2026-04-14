## Context

`apps/agent-backend` 当前已经以 `streamFirstByteTimeoutMs` 和 `streamIdleTimeoutMs` 实现流式 watchdog，但模型配置层仍保留 `requestTimeoutMs`，并在 `ConfigLoader` 中允许三类模型 timeout 被环境变量覆盖。这导致同一类运行时策略同时受遗留字段、`config.json` 和环境变量影响，行为来源不透明，也与仓库的 debug-first 原则冲突。

这次变更横跨配置加载、模型类型、runtime 元数据和测试用例，属于需要先统一语义再实施的收敛型改动。

## Goals / Non-Goals

**Goals:**

- 将模型流式 timeout 的配置来源收敛为 `apps/agent-backend/config.json`。
- 删除遗留字段 `requestTimeoutMs`，只保留首包超时和流式空闲超时两个字段。
- 让非法或过时 timeout 配置显式失败，而不是静默兼容或回退。
- 保持现有 watchdog 两阶段行为不变，只调整配置语义与外显接口。

**Non-Goals:**

- 不改变 upstream streaming 的读流实现。
- 不引入新的 timeout 阶段或新的部署配置来源。
- 不保留对遗留 `requestTimeoutMs` 或相关环境变量的兼容路径。

## Decisions

### 1. `config.json` 成为模型 timeout 的唯一配置来源

模型 timeout 只从 `agent.defaultModel` / `agent.modelRegistry` / `agent.modelsByAgent` 中的 `streamFirstByteTimeoutMs` 与 `streamIdleTimeoutMs` 读取，不再接受 `AGENT_MODEL_REQUEST_TIMEOUT_MS`、`AGENT_MODEL_STREAM_FIRST_BYTE_TIMEOUT_MS`、`AGENT_MODEL_STREAM_IDLE_TIMEOUT_MS` 覆盖。

理由：

- timeout 属于运行策略，不应被进程环境静默改写。
- 单一来源更便于排查“配置已改但行为未变”的问题。

备选方案：

- 保留环境变量但打印最终值。未采纳，因为仍保留双重来源和覆盖复杂度。

### 2. 删除 `requestTimeoutMs`，并将其视为过时配置错误

从模型配置类型、校验、归一化和 runtime 展示里移除 `requestTimeoutMs`。若 `config.json` 仍声明该字段，启动时应抛出显式配置错误，而不是继续把它当成 `streamFirstByteTimeoutMs` / `streamIdleTimeoutMs` 的回退值。

理由：

- 该字段名称暗示“整请求硬超时”，但当前实现已不再按该语义工作。
- 保留回退会继续制造隐性行为和历史包袱。

备选方案：

- 忽略 `requestTimeoutMs`。未采纳，因为静默忽略会掩盖失效配置。

### 3. Runtime 元数据接口同步收缩到两个流式 timeout 字段

`AgentModelConfig`、`AgentModelRegistry` 的 runtime 信息以及 `/agent/api/agent/runtime` 暴露面只保留 `streamFirstByteTimeoutMs` 与 `streamIdleTimeoutMs`，移除 `requestTimeoutMs`。

理由：

- 对外展示必须和实际生效配置一致。
- 避免前端或调试接口继续传播已废弃字段。

### 4. 以测试和文档兜底配置语义

测试需要覆盖：

- `config.json` 的两个 timeout 字段被正确加载。
- 环境变量不再覆盖模型 timeout。
- `requestTimeoutMs` 作为旧字段出现时启动失败。
- runtime 元数据和相关 README 不再出现旧字段。

理由：

- 这次变更本质是语义收敛，回归风险主要来自残留引用和隐式兼容。

## Risks / Trade-offs

- [Risk] 旧本地配置仍含 `requestTimeoutMs`，升级后会直接启动失败。 -> Mitigation: 在 README 和变更说明中明确这是破坏性配置清理，并要求改成两个显式字段。
- [Risk] 某些测试仍依赖旧字段或旧 runtime 输出。 -> Mitigation: 同步清理类型、测试数据和断言，避免局部删除导致编译或测试悬空。
- [Risk] 运维习惯使用环境变量临时调整 timeout。 -> Mitigation: 明确改为编辑 `config.json` 后重启服务，避免运行态隐藏状态。

## Migration Plan

1. 更新 `apps/agent-backend/config.json` 和示例文档，只保留 `streamFirstByteTimeoutMs` 与 `streamIdleTimeoutMs`。
2. 删除 `ConfigLoader` 中三类模型 timeout 的环境变量覆盖逻辑。
3. 删除 `requestTimeoutMs` 类型、归一化、runtime 暴露和测试引用。
4. 对残留 `requestTimeoutMs` 配置执行显式校验失败，确保迁移错误可见。

## Open Questions

- None.
