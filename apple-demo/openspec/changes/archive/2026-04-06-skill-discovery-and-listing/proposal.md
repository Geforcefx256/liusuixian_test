## Why

当前 `agent-backend` 会在 executor 运行链和 `skill` tool 描述里重复暴露可用 skill 列表，但这两个面都没有稳定分层：模型既看不到“先判断要不要加载 skill”的轻量摘要边界，也会被重复的 skill catalog 持续占用上下文预算。

这次 change 先不实现真正的 discovery，而是先把 build/executor 的 skill listing contract 固化下来：明确 listing reminder 只负责告诉模型“有哪些 skill 可用”，完整 `SKILL.md` 仍通过现有 `skill:skill` 按需加载，并且对预算裁剪和 reminder 注入过程提供显式日志。

## What Changes

- 在 build/executor 模型调用前注入一个 conversation-level 的 model-facing `listing reminder`，来源于当前请求已治理、已授权的 `availableSkills`。
- 将 listing reminder 的摘要字段固定为 `name`、`description`、`whenToUse`，不再在该面暴露完整 `SKILL.md` 或其他冗余 frontmatter。
- 将 `skill` tool 描述改为静态使用说明，不再内联当前 skill catalog；完整 `SKILL.md` 继续通过既有 `skill:skill` 路径显式加载。
- 为 discovery 保留显式的 disabled scaffold 作为内部诊断语义，本次不做相关性排序、候选池筛选或隐式 fallback。
- 为 listing 构建、条目裁剪、预算跳过和 reminder 注入增加结构化日志，确保上下文预算行为可观测。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 为 build/executor 增加 budgeted skill listing reminder，收敛 `skill` tool discovery 文案，并要求预算裁剪与 reminder 注入行为具备显式 observability。

## Impact

- Affected code:
  - `apps/agent-backend/src/agent/chatOrchestrator.ts`
  - `apps/agent-backend/src/agent/workspace/buildPhase.ts`
  - `apps/agent-backend/src/runtime/tools/skill/content.ts`
  - `apps/agent-backend/src/runtime/tools/providers/skillProvider.ts`
  - related tests under `apps/agent-backend/src/agent/**`, `apps/agent-backend/src/runtime/tools/**`, and `apps/agent-backend/tests/**`
- Affected runtime surfaces:
  - build/executor conversation reminder injection
  - `skill` tool description text
  - structured runtime logging for skill listing budgeting and injection
- No new top-level directories and no new third-party dependencies are intended in this change.
