## Why

当前工作空间侧栏 `NEW` 菜单只能通过再次点击 `NEW` 按钮收起，缺少“点击外部关闭”和 `Esc` 关闭，导致交互不符合常见预期，也与现有文件操作菜单的行为不一致。

## What Changes

- 为工作空间侧栏 `NEW` 下拉菜单补充可取消（dismiss）交互：
  - 点击菜单外部区域时关闭。
  - 按 `Escape` 键时关闭。
- 保留现有再次点击 `NEW` 按钮可关闭的行为，避免破坏已形成的使用习惯。
- 补充组件测试，覆盖外部点击和 `Esc` 关闭路径，确保行为稳定。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `agent-web-workbench`: 调整工作空间侧栏 `NEW` 菜单的关闭规则，要求支持 outside click 与 `Escape` 快捷关闭。

## Impact

- Affected specs: `openspec/specs/agent-web-workbench/spec.md`
- Affected frontend: `apps/web/src/components/workbench/WorkspaceSidebar.vue`
- Affected tests: `apps/web/src/components/workbench/WorkspaceSidebar.test.ts`
- 不涉及新增或升级第三方依赖。
- 不涉及顶层目录结构变更。
