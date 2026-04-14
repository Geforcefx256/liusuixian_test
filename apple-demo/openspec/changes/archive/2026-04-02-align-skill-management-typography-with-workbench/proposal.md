## Why

当前 `Skill 管理` 页面虽然复用了工作台的全局字体 token，但在 hero 说明文案、分区标题和部分名称文本上选择了不同的字号层级，导致它整体看起来比工作台主视图更松、更像独立后台页，而不是同一套 workbench surface。既然管理员主要在同一个壳内来回切换 `工作台` 与 `Skill 管理`，现在需要把 Skill 管理页的字体语义收敛到工作台既有基线，降低视觉跳变和阅读负担。

## What Changes

- 以工作台现有字体层级为基线，重新梳理 `Skill 管理` 页面中页面标题、卡片标题、分区标题、控件文字、说明文案和辅助信息的字号映射。
- 保留现有全局 typography token，不新增新的字号体系，也不把 Skill 管理页做成独立设计语言。
- 将 `Skill 管理` hero 说明文案、分区标题和列表/绑定名称文本收敛到与 `HomeStage`、`ConversationPane`、`UserManagementDrawer` 一致的语义层级。
- 补充前端样式回归验证，确保后续修改不会再次让 Skill 管理页偏离工作台字体基线。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: 管理页中的治理列表、治理详情和说明区需要遵循工作台现有字体语义层级，而不是使用独立的页面内字号选择。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/AdminSkillManagement.vue`
  - related frontend unit tests
- APIs:
  - 无 API 契约变化
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - 工作台 admin 壳内的 Skill 管理页面排版一致性
