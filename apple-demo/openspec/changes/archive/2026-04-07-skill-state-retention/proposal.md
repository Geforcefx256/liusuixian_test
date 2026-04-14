## Why

当前 `agent-backend` 在 skill 被加载后，会把 `skill:skill` 的返回内容作为普通工具结果写入会话消息，但 compact 阶段只产出通用摘要，不会把这些已调用 skill 的内容作为独立上下文继续保留。结果是，一旦原始 skill 工具消息落到摘要覆盖范围外，模型在后续 continuation 中可能失去继续执行所需的 canonical skill instructions。

这次 change 需要补上一条最小 retention 链路，只解决“已调用 skill 的内容在 compact 后仍然可见”这个问题。它参考 `claude-code` 的 invoked-skill retention 行为，但结合当前 web 服务已经持久化完整会话消息的现实，优先采用更简单的重建式实现，而不是继续扩展 progress memo、resume 恢复或多 agent 状态机。

## What Changes

- Add a minimal `skill-state-retention` capability for `agent-backend` that preserves invoked skill content across compaction.
- Reconstruct retained skills from persisted successful `skill:skill` session messages instead of mixing skill content into the generic compact summary.
- Inject retained skill content as a dedicated runtime reminder message that stays separate from the compacted summary and from skill listing/discovery reminders.
- Keep only the latest successful retained content for each skill name within one session scope.
- Add explicit diagnostic logging for retained-skill extraction, injection, budget skips, and empty-retention decisions.
- Keep this change limited to compact-time retention only:
  - no progress memo fields
  - no per-skill workflow state
  - no process-restart/session-resume restoration design
  - no multi-agent isolation work beyond existing session scoping

## Capabilities

### New Capabilities
- `skill-state-retention`: Preserve invoked skill content as a dedicated post-compaction runtime context reminder for the active session.

### Modified Capabilities
<!-- None. -->

## Impact

- Affected backend runtime paths:
  - `apps/agent-backend/src/agent/context/ContextManager.ts`
  - `apps/agent-backend/src/agent/context/ConversationCompactor.ts`
  - `apps/agent-backend/src/runtime/tools/providers/skillProvider.ts`
  - `apps/agent-backend/src/agent/sessionStoreTypes.ts`
- Likely adds one retention-focused helper in `apps/agent-backend/src/agent/context/` for extracting and rendering retained skill reminders from persisted session messages.
- Reference implementation to compare against during coding:
  - `~/Documents/code/codex/claude-code/src/bootstrap/state.ts`
  - `~/Documents/code/codex/claude-code/src/services/compact/compact.ts`
  - `~/Documents/code/codex/claude-code/src/tools/SkillTool/SkillTool.ts`
- No third-party dependency change is proposed.
- No top-level directory restructuring is proposed.
