## Why

用户在技能搜索面板输入关键词后，若无匹配结果，当前仅显示一行静态提示文字，用户没有任何可操作的下一步，只能手动清空输入或放弃搜索。

## What Changes

- 在技能搜索空结果状态下，提示文字下方新增分类快捷 Tag 按钮，但仅展示当前存在 skill 的分类
- 点击任意 Tag 后，将对应的分类搜索词填入搜索框，触发现有过滤逻辑，展示该分类下的所有技能
- 若当前三个分类均无 skill，则不展示任何分类 Tag，仅保留空结果提示文案

## Capabilities

### New Capabilities

- `skill-search-empty-tags`: 技能搜索空结果状态下的分类快捷 Tag，允许用户一键切换至分类浏览

### Modified Capabilities

（无）

## Impact

- 改动文件：`apps/web/src/components/workbench/ConversationPane.vue`（模板 + 样式 + 动态分类映射）
- 不涉及后端、API、路由或依赖变更
- 不改动父组件过滤逻辑与 emit 事件签名
