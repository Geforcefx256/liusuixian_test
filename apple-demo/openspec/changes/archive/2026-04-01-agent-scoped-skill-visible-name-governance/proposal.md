## Why

当前 Skill 治理只提供单一全局 `displayName`，而前台对话气泡、运行中 header 等用户可见槽位仍可能回落到 `skillId` 或 canonical skill name。这样会把内部标识暴露给终端用户，也无法满足同一个 canonical skill 在不同 Agent 下使用不同用户可见名称的治理需求。

## What Changes

- 将 managed skill 的用户可见名称治理从“每个 skill 一份全局名称”提升为“按 Agent 绑定维度分别治理的名称”。
- 明确所有用户可见的“技能名称槽位”必须读取治理后的用户可见名称，而不是 `skillId`、canonical skill name，或前端硬编码别名。
- 要求同一 Agent 内的用户可见名称唯一，并将空值或仍等于默认导入值（`skillId` / canonical name）的状态判定为“未完成治理”。
- 要求未完成治理的 Skill 只能停留在 `测试` 态，继续保留“已纳管，但不进入正常工作台前台和运行时”的现有语义。
- 保留用户态 header 中的 `Skill:` 机制词，但其后展示的名称必须来自治理层。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-management`: 调整 managed skill 治理模型与约束，支持按 Agent 维度配置唯一的用户可见名称，并将未完成治理与 `测试` 态绑定。
- `agent-backend-runtime`: 调整 governed runtime metadata 和事件输出，确保用户可见技能名称按当前 Agent 解析，且不会在用户态回落为内部 skill 标识。
- `agent-web-workbench`: 调整 workbench 中搜索、starter、运行中 header、完成态 summary 等技能名称槽位，只展示治理后的用户可见名称。

## Impact

- Affected code:
  - `apps/agent-backend/src/skills/**`
  - `apps/agent-backend/src/agents/**`
  - `apps/agent-backend/src/agent/**`
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/components/workbench/AdminSkillManagement.vue`
- Affected APIs:
  - Managed skill admin read/update payloads
  - Agent detail / runtime bootstrap governed skill metadata
  - Runtime `tool.started` and completed summary naming inputs
- No top-level directory changes.
- No new third-party dependencies are required.
