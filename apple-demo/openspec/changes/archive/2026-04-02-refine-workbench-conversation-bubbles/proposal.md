## Why

当前 workbench 会把一次用户请求中的多条 assistant 中间说明原样渲染为多个气泡，尤其在 `local:grep` 这类多步检索链路里会显得啰嗦，用户需要在大量过程性文本里自己寻找最终有效结论，前端阅读负担偏高。

同时，Question Tool 在用户回答后会把 continuation 文本中的 `[INTERACTION CONTEXT] ... answer: {...}` 直接暴露成普通用户气泡。该内容虽然对运行时 replay 有意义，但对前端阅读并不友好，且无法把选择题答案和补充文本自然展示给用户。

## What Changes

- 在 workbench 对话区引入“主气泡 + 过程折叠”的 assistant 展示模型，将同一轮内连续的过程型 assistant 消息收敛为可折叠步骤，只把最终结果作为主气泡默认展示。
- 为 assistant 过程折叠定义稳定的前端分组与文案策略，确保刷新后仍能基于持久化历史重建一致的收敛展示，而不修改后端持久化的原始 `message[]`。
- 将 Question Tool 回答后的 `[INTERACTION CONTEXT]` continuation 文本改写为面向用户的摘要气泡，选择题展示具体选项内容，填空题展示实际输入文本，补充字段展示用户填写的备注。
- 统一 Question Tool 回答摘要的排版规则，避免暴露 `interaction_id`、`question_id`、原始 JSON 等运行时内部字段。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 修改会话消息在前端的分组展示、assistant 过程折叠呈现方式，以及 Question Tool 回答气泡的摘要化渲染规则。

## Impact

- Affected frontend code in `apps/web/src/stores/workbenchStore.ts`, `apps/web/src/components/workbench/**`, and related message/interactions rendering utilities and tests.
- Affected user-visible behavior includes assistant conversation density, expanded/collapsed process visibility, Question Tool answer summaries, and history reload consistency.
- APIs, persisted session messages, and backend interaction replay semantics remain unchanged.
