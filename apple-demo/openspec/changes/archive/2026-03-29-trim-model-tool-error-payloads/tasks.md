## 1. 收敛主循环 machine-facing tool error payload

- [x] 1.1 更新主 `AgentLoop` 的 tool error payload 组装逻辑，只保留最小纠错字段（`success`、`code`、`recoverable`、`retryHint`、`error`）并移除默认回灌的运行时控制元数据
- [x] 1.2 保持 `ToolInvocationError`、terminal `runtimeError` 与 telemetry 继续携带 stop reason、chain metadata、threshold 与 retry diagnostics

## 2. 增加可选结构化差量提示

- [x] 2.1 为 machine-facing tool error payload 定义可选的 `field`、`expected`、`actual`、`fix` 字段，并确保缺少高置信度信息时按缺省处理
- [x] 2.2 在线性可判断的校验路径上补充第一批差量提示输出，至少覆盖 `local:question` 这类稳定的结构化输入校验错误

## 3. 更新测试与回归验证

- [x] 3.1 调整主循环相关测试，改为断言精简后的 tool error payload，而不再依赖 `attempt`、`chainKey`、`remainingRecoveryBudget` 等字段出现在模型面 payload 中
- [x] 3.2 补充测试，验证 terminal `runtimeError` 和日志/telemetry 仍然保留 stop reason、normalized code 与链路诊断元数据
- [x] 3.3 补充测试，验证 `field` / `expected` / `actual` / `fix` 仅在可稳定判断时返回，无法可靠判断时保持缺省
