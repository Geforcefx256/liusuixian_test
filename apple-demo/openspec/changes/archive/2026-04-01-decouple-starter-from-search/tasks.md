## 1. 状态重构

- [x] 1.1 在 `workbenchStore.ts` 中新增 `selectedStarterSkillId` ref（`Ref<string | null>`），并提供 `selectStarterSkill(id: string | null)` action 和 `selectedStarterSkill` computed（返回选中的 skill 对象）。
- [x] 1.2 移除 `SkillDiscoveryContext` 接口、`skillDiscoveryContext` ref、`focusStarterDiscovery()`、`clearSkillDiscoveryContext()` 以及所有消费 discovery context 的代码。
- [x] 1.3 移除 `filterSkillsByDiscoveryContext()` 和 `prioritizeRepresentativeSkill()` 纯函数。
- [x] 1.4 简化 `searchableSkills` computed：直接对 `visibleSkills` 做 `filterSkillsBySearchQuery`，移除 discovery context 过滤和代表 skill 置顶，改用 `compareStarterSkills` 排序。
- [x] 1.5 从 `StarterGroupView` 接口中移除 `skill: StarterSkillView | null` 字段（代表 skill），保留 `previewSkills`。
- [x] 1.6 在 `startNewConversation()` 和 agent 切换逻辑中同步清除 `selectedStarterSkillId`。

## 2. 快速开始交互重构

- [x] 2.1 修改 `ConversationPane.vue` 的快速开始模板：每个 preview skill 名称作为独立可点击元素，点击时通过 `selectedStarterSkillId` 控制展开/收起。
- [x] 2.2 选中态渲染：在卡片内原地展开 skill 描述文字和"开始使用 →"文字链接，其余未选中 skill 保持列表项形式。
- [x] 2.3 "开始使用 →" 链接点击时 emit `send-prompt` 事件发送 `starterPrompt`，随后清除 `selectedStarterSkillId`。
- [x] 2.4 移除 `handleStarterSelection()` 函数和 `@click="handleStarterSelection(group)"` 事件绑定。
- [x] 2.5 移除 `emit('discover-group', ...)` 相关代码和 props 定义中的 `discover-group` 事件。

## 3. 更多搜索重构

- [x] 3.1 更多搜索默认展开：将 `searchPanelOpen` 初始值改为 `true`，或移除折叠/展开 toggle（视实现简化程度决定）。
- [x] 3.2 移除 discovery context 横幅 UI（`来自常用起点: xxx`）及其相关代码。
- [x] 3.3 无搜索词时只展示热门技能 chip，不展示全量技能列表。移除无搜索词时的全量列表渲染分支。
- [x] 3.4 搜索结果中的 skill 点击行为与快速开始一致：展开描述 + "开始使用 →"链接，使用同一个 `selectedStarterSkillId` 保证全局互斥。
- [x] 3.5 移除代表 skill 相关 UI：`Starter 推荐` badge、代表 skill 置顶区块。
- [x] 3.6 热门 chip 点击改为填入搜索框作为关键词（保持现有 `applySuggestion` 行为）。

## 4. 联动清理

- [x] 4.1 移除 `WorkbenchShell.vue` 中的 `handleStarterDiscovery()` 函数和 `@discover-group` 事件绑定。
- [x] 4.2 移除 `clearDiscoveryState()` 函数和 `@clear-discovery` 事件。
- [x] 4.3 确保 `toggleSearchPanel()` 不再调用 `clearDiscoveryState()`。

## 5. 验证

- [x] 5.1 更新 `workbenchStore.test.ts`：移除 discovery context 相关测试，新增 `selectedStarterSkillId` 选中/清除/全局互斥测试，验证 `searchableSkills` 不再受 discovery context 影响。
- [x] 5.2 更新 `ConversationPane.test.ts`：覆盖 skill 两步选中（点击展开 → 点击开始使用发送）、手风琴互斥、跨卡片/跨区域全局单选、空分组不响应点击。
- [x] 5.3 运行 `pnpm type-check` 和 `pnpm test`，确认所有改动通过。
