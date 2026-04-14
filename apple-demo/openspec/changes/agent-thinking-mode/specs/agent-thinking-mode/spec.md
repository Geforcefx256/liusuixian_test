## agent-thinking-mode

Agent 与大模型交互时支持 thinking 推理模式。

### Behavior

- 当 `AgentModelConfig.thinking.enabled` 为 `true` 时，providerClient 在请求中注入 provider 特定的 thinking 参数
- 模型返回的 thinking/reasoning 内容从响应中分离，不混入正文 text
- Agent loop 的 tool 循环中，reasoning_content 随 assistant message 回传给 API（满足 DeepSeek 约束）
- Agent loop 结束后，reasoning 内容不写入 session 历史（不膨胀上下文）
- Thinking 开启时，`temperature`、`top_p`、`top_k` 参数不发送

### Provider 映射

| Provider | 请求参数 | 响应格式 |
|----------|----------|----------|
| openai (DeepSeek 直连) | `body.thinking = { type: "enabled" }` | `delta.reasoning_content` |
| huaweiHisApi (vLLM) | `body.chat_template_kwargs = { enable_thinking: true }` | `delta.reasoning_content` |

### Config 格式

```json
{
  "thinking": {
    "enabled": true,
    "budgetTokens": 8192
  }
}
```

- `enabled`：是否开启 thinking 模式
- `budgetTokens`：可选，thinking token 上限（预留，Phase 1 不实现限制逻辑）
