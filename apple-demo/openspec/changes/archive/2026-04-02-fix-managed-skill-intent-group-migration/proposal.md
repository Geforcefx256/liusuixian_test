## Why

历史 managed skill registry 仍然保存了已废弃的 `intentGroup` 值 `data-transformation`，而当前后端管理接口只接受 `planning`、`configuration-authoring`、`verification` 三种分组。结果是管理员即使只修改描述或绑定名称，`Skill 管理` 页面也会把旧值原样回传并触发 `Invalid intentGroup`，导致治理保存链路失效。

## What Changes

- 在 managed skill registry 加载阶段校验并迁移历史非法 `intentGroup` 值，避免旧数据继续留在运行时和持久化文件中。
- 为历史 `intentGroup` 迁移建立显式规则：优先回落到当前 `DEFAULT_POLICIES` 中该 skill 的合法分组，否则清空为未分组。
- 在注册表修复历史值后回写 `managed-skills.json`，确保后续保存不再携带废弃分组。
- 调整管理端保存链路，前后端共享同一套合法 `intentGroup` 定义，并阻止未知分组值再次被原样 round-trip。
- 在 `Skill 管理` 页面显式暴露历史非法分组已被清空/需重新选择的状态，避免 silent fallback。
- 为 registry 迁移、管理接口保存、前端管理页展示与提交流程补充回归测试。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: managed skill 治理必须能够迁移历史非法 `intentGroup` 数据，并保证管理保存链路不会因遗留分组值而失败。

## Impact

- Affected code: `apps/agent-backend/src/skills/managedRegistry.ts`, `apps/agent-backend/src/skills/managedTypes.ts`, `apps/agent-backend/src/routes/adminSkills.ts`, `apps/web/src/components/workbench/AdminSkillManagement.vue`
- Affected tests: managed skill registry tests, admin skill route tests, admin skill management frontend tests
- Affected runtime data: existing `apps/agent-backend/data/managed-skills.json` records may be migrated on load and rewritten with合法 `intentGroup` 或空值
- Dependencies: none
