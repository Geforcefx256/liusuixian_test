## Why

`local:question` 当前在模型连续构造非法 payload 时，会沿着 model-recovery 链一路走到 `model_recovery_exhausted` 并以终态失败结束。这会把用户卡死在工具重试失败里，即使用户其实完全可以通过普通文本继续补充信息。

## What Changes

- Add an explicit runtime degradation path for `local:question` validation loops that exhaust model recovery.
- Append a fixed assistant plain-text message to the session when that degradation path triggers so the user can continue through ordinary chat input.
- Keep the original tool failure details in runtime logs and diagnostics only; do not expose the tool error payload through frontend-visible assistant history once degradation happens.
- Do not create a pending question interaction, awaiting-interaction outcome, or structured continuation state for the degraded path.
- Treat the user's next reply after degradation as ordinary run input instead of `question_response` continuation input.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: change `local:question` recovery-exhaustion behavior so repeated validation failures degrade into a visible plain-text assistant prompt instead of terminating the run as a runtime tool failure.

## Impact

- Affected code: `app/agent-backend` agent loop, tool failure handling, runtime result shaping, and logging/telemetry around `local:question`.
- Affected UX: question failure loops become user-visible plain-text prompts instead of hard terminal errors.
- No new external dependencies or frontend protocol types are required.
