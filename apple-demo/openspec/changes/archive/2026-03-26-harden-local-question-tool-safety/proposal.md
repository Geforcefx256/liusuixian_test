## Why

`local:question` 目前在必填 `select` 场景下会默认选中第一项，存在用户未显式选择却被当作已回答的误答风险。与此同时，question 工具的定义校验和回答回传校验偏弱，面向模型的错误信息又过长，容易在不同 LLM 上造成低效重试和不稳定纠错。

## What Changes

- 调整 `local:question` 的 `select` 默认值策略，避免必填问题在未交互前自动形成答案。
- 为 question 表单补充字段级 `required` 语义，保留顶层 `required` 作为默认值而不是唯一约束。
- 强化 `local:question` 的后端定义校验，覆盖字段冲突、重复值、非法空值和不安全默认值等问题。
- 为 question 回答增加最小后端校验，在继续会话前校验 `questionId`、字段集合、选项值和必填项是否匹配原始协议消息。
- 精简 `local:question` 面向模型的校验错误文案，保留日志中的详细错误用于排查。
- 收敛 workspace-agent 中关于 question 工具的冗长规则，只保留高信号约束，避免与 tool description 重复漂移。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-backend-runtime`: 调整 question tool 的输出、校验和回答处理契约，降低误答风险并增强后端防错能力。
- `agent-web-workbench`: 调整 question 协议表单的默认值与必填校验行为，确保提交前需要用户显式完成必要输入。

## Impact

- Affected code:
  - `apps/agent-backend/src/runtime/tools/local/question.ts`
  - `apps/agent-backend/src/runtime/tools/local/schemas.ts`
  - `apps/agent-backend/src/runtime/tools/providers/localProvider.ts`
  - `apps/agent-backend/src/agent/*` 中与 tool failure / question 回答识别相关路径
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/components/workbench/protocolRuntime.ts`
  - `apps/agent-backend/assets/agents/workspace-agent/CONTEXT.md`
- Affected systems:
  - backend question tool validation
  - workbench question submit flow
  - model recovery behavior after invalid question tool calls
- No new external dependencies or standalone APIs are required.
