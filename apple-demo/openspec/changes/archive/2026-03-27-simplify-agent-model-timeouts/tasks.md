## 1. 收敛模型 timeout 配置面

- [x] 1.1 从 `apps/agent-backend` 的模型配置类型、runtime 元数据和路由返回结构中移除 `requestTimeoutMs`
- [x] 1.2 删除 `ConfigLoader` 中模型 timeout 的环境变量覆盖逻辑，只保留 `config.json` 的 `streamFirstByteTimeoutMs` 与 `streamIdleTimeoutMs`
- [x] 1.3 移除 `providerClient` 中基于 `requestTimeoutMs` 的遗留回退逻辑，改为只使用两个显式 streaming timeout 字段

## 2. 强化配置校验与失败暴露

- [x] 2.1 为 `agent.defaultModel`、`agent.modelRegistry` 和 `agent.modelsByAgent` 增加对遗留 `requestTimeoutMs` 的显式校验失败
- [x] 2.2 清理模型配置归一化逻辑中对 `requestTimeoutMs` 的兼容映射，确保旧字段不会再被静默解释

## 3. 更新文档与验证

- [x] 3.1 更新 `apps/agent-backend/config.json`、README 和相关说明，只保留两个 streaming timeout 字段并说明修改配置后需要重启服务
- [x] 3.2 更新或新增测试，覆盖 `config.json` timeout 加载、环境变量不再生效、旧字段触发启动失败，以及 runtime 元数据不再暴露 `requestTimeoutMs`
