## Why

当前 `agent-backend` 的 `skill:skill` 只把 `SKILL.md` 正文作为 tool summary 返回，模型后续是否真正持续遵循这些指令，取决于它是否继续显式参考上一条 tool result。随着会话变长、上下文压缩和重跑恢复参与其中，这种“skill 只存在于工具输出里”的方式不够稳，也把 skill retention 建立在字符串扫描和正则提取之上。

现在需要把 skill 加载从“工具返回文本”升级成“工具调用后显式注入隐藏的 skill context message”，让 runtime、会话恢复和压缩回注都围绕显式语义而不是隐式字符串协议运作。

## What Changes

- Extend gateway tool invoke success payloads so tools can emit typed side effects, starting with injected context messages.
- Change `skill:skill` to return a short operator-facing summary while injecting the canonical skill body into session context as a hidden message.
- Persist hidden skill-context messages in session history so resumed sessions and later turns can reconstruct the same runtime context.
- Filter hidden skill-context messages out of user-facing session history views so the workbench UI does not render new ordinary assistant bubbles.
- Replace retained-skill reconstruction from `skill:skill` tool output scanning with reconstruction from explicit persisted skill-context messages.
- Update compaction and context-building behavior so retained skill content remains separate from the normal conversation summary and is not silently collapsed into generic summary text.
- Keep planner-specific execution paths out of scope for this change; planner behavior may continue using the current mechanism until a follow-up change addresses it.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: session persistence, tool invocation, and session-history views now need to support hidden injected skill-context messages while keeping the workbench-visible message stream unchanged.
- `skill-state-retention`: retained skill reconstruction and reinjection now need to operate on explicit persisted skill-context messages instead of scanning successful `skill:skill` tool outputs.

## Impact

- Affected code is concentrated in `apps/agent-backend`, including gateway tool invoke types, the skill tool provider, agent loop persistence flow, session storage/message views, and context compaction/retention logic.
- Frontend impact should stay minimal because hidden skill-context messages will not be returned in the normal session-history view used by the workbench.
- No top-level directory changes are required.
- No third-party dependency additions or version changes are required.
