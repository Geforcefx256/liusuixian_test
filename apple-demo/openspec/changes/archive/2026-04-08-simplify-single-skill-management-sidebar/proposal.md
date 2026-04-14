## Why

当前 `Skill 管理` 页面左侧沿用了治理列表形态：标题、搜索、筛选、统计和列表项共同服务于“在多条 skill 之间切换”的旧导航模式。这个结构在单条 skill 场景下会制造空白和重复选中态，在多条 skill 场景下也把注意力拉向列表管理控件，而不是每条 skill 当前的治理状态摘要。

## What Changes

- 将 `Skill 管理` 页左侧统一收敛为摘要卡导航 rail，不再区分单 skill 与多 skill 的不同信息架构。
- 左侧移除 `治理列表` 标题、搜索框、生命周期筛选和草稿 / 已发布统计，仅保留可点击的 skill 摘要卡。
- 每张摘要卡只展示治理后的名称占位、生命周期、Starter 状态，以及在 Starter 启用时展示意图分组标签。
- 明确当用户可见名称为空时，左侧主标题显示 `待填写用户可见名称`，而不是回退到 canonicalName 或 skillId。
- 在多 skill 场景下继续保留左侧切换能力，但通过摘要卡点击切换当前治理对象。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: 调整管理页左侧信息架构与展示要求，统一使用摘要卡导航呈现单项与多项治理数据。

## Impact

- Affected spec: `openspec/specs/skill-management/spec.md`
- Affected UI: `apps/web/src/components/workbench/AdminSkillManagement.vue`
- Affected tests: `apps/web/src/components/workbench/AdminSkillManagement.test.ts`
- No top-level directory changes
- No third-party dependency changes
