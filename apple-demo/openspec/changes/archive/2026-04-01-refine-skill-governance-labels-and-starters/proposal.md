## Why

当前 Skill 管理页、空会话工作台和技能搜索入口对同一套治理数据的呈现不一致：管理页术语带有“展示面 / 生产面 / 实验面”的旧表述，聊天页常用起点只展示抽象分组而不展示治理后的技能名称，而治理名称保存后也不会及时反映到工作台入口。这个割裂让管理员很难确认治理配置是否已经生效，也让终端用户难以理解每个起点实际对应的技能能力。

现在需要把这些入口统一到同一套用户可见语义上，让治理后的名称、展示策略和起点入口形成一致的产品体验。

## What Changes

- 统一 Skill 管理页中的治理术语，将“展示面 / 生产面 / 实验面”收敛为“展示 / 生产 / 测试”，并同步更新相关说明文案、筛选项和状态展示。
- 调整空会话工作台中的“常用起点”卡片，去掉重复动作文案，改为展示每个分组下的治理后技能名称预览，同时保持整卡单一点击行为不变。
- 让“常用起点”“更多搜索 / 热门技能”和首页代表 starter 一致使用治理后的用户可见名称，而不是回退到 skill id 或过时缓存。
- 修复 Skill 管理页保存治理信息后，工作台技能入口未同步刷新的状态链路问题。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: 调整管理员在技能治理页面看到和操作的用户可见术语，并要求治理后的展示名称能稳定反映到面向用户的技能入口。
- `agent-web-workbench`: 调整空会话工作台中的常用起点与技能搜索呈现，要求其展示治理后的技能名称预览，并在治理信息变更后及时刷新。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/AdminSkillManagement.vue`
  - `apps/web/src/components/workbench/ConversationPane.vue`
  - `apps/web/src/components/workbench/HomeStage.vue`
  - `apps/web/src/stores/workbenchStore.ts`
  - related frontend tests under `apps/web/src/components/workbench/` and `apps/web/src/stores/`
- Affected systems:
  - managed skill governance UI
  - workbench empty-state starter discovery surfaces
  - frontend state synchronization between admin governance and active agent metadata
- No top-level directory changes.
- No new third-party dependencies are required.
