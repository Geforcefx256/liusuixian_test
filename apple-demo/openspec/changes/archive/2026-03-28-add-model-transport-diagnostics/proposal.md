## Why

当前 `huaweiHisApi` 内网模型偶发出现 `failureKind=transport` 的失败，但运行时日志只暴露顶层 `TypeError: fetch failed`，无法区分是未收到响应头、底层连接被中断，还是上游链路在长时间等待后超时。与此同时，错误路径的运行计时把模型等待时间计入 `otherCostTime`，会误导排障判断。

## What Changes

- 增强模型传输失败日志，展开 `fetch` 错误的底层 cause 链路，并记录可用于区分网络层、TLS/连接层和上游超时的关键字段。
- 为模型请求补充阶段化日志，明确区分“请求已发出但未收到响应头”和“已收到响应头后进入流式读取”的失败位置。
- 修正错误路径的运行计时归因，使失败模型调用的耗时仍然进入模型维度，而不是全部落入 `otherCostTime`。
- 保持现有模型配置、超时配置和 `config.json` 基线不变，只增加诊断信息和更准确的计时。
- 将实现范围限制在模型诊断链路相关代码，不修改与本次 transport 排障无关的业务逻辑或功能行为。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-backend-runtime`: runtime error observability for model transport failures and failed model-call timing attribution becomes more explicit and diagnosable.

## Impact

- Affected code: `apps/agent-backend/src/agent/providerClient.ts`, `apps/agent-backend/src/agent/service/runtimeErrors.ts`, `apps/agent-backend/src/agent/service/RunExecution.ts`, `apps/agent-backend/src/agent/service/runTiming.ts`, and related tests.
- Affected systems: backend runtime logging, model-call telemetry, terminal runtime error diagnostics.
- No config schema changes and no `config.json` value changes.
- Unrelated business modules and user-facing business behavior are out of scope for this change.
