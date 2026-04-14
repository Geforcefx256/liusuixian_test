## 1. Upstream Streaming Pipeline

- [x] 1.1 在 `apps/agent-backend/src/agent/providerClient.ts` 中为 `/chat/completions` 增加上游流式请求与 chunk 解析路径，支持文本增量、tool call 增量和 finish signal 组装。
- [x] 1.2 调整 `agentLoop` / `chatOrchestrator` / `RunExecution` 的模型步骤收口逻辑，使其能够消费流式组装后的最终模型结果而不依赖整包 JSON。
- [x] 1.3 保持 `agent-backend -> web` 现有 `/agent/api/agent/run` NDJSON 契约兼容，确保 phase 1 不要求前端同步重构。

## 2. Watchdog Timeout And Failure Semantics

- [x] 2.1 为主链路 streaming 请求引入首包超时与空闲超时语义，并明确配置入口与默认值，不再把累计总时长作为默认健康流终止条件。
- [x] 2.2 在上游流解析中按“有效进展”刷新 watchdog，避免把空 heartbeat 或无效碎片当作健康推进。
- [x] 2.3 调整 `modelRequestError`、`runtimeErrors` 和运行时终态收口，使首包超时、空闲超时、流中断和取消都通过显式失败或取消路径暴露，且不会把 partial output 伪装成成功结果。

## 3. Verification

- [x] 3.1 为 `providerClient` 补充流式单元测试，覆盖文本流、tool call 增量组装、finish signal、首包超时和空闲超时场景。
- [x] 3.2 为运行时执行链路补充测试，验证流式失败不会落成成功 assistant 终态，并保持现有 runtime error 结构化输出。
- [x] 3.3 验证当前 `apps/web` 仍可通过现有 NDJSON 解析器消费 `/agent/api/agent/run`，且终态结果结构与现有前端契约兼容。
