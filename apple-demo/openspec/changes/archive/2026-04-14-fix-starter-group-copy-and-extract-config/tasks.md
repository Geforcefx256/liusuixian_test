## 1. 提取 STARTER_GROUP_META 为 JSON 配置

- [x] 1.1 新建 `apps/web/src/config/starterGroups.json`，内容从 `workbenchStore.ts` 的 `STARTER_GROUP_META` 常量复制，同时修正三条 subtitle 文案（选则→选择，场景→Skill）
- [x] 1.2 修改 `apps/web/src/stores/workbenchStore.ts`：移除 `STARTER_GROUP_META` 常量定义，改为 `import STARTER_GROUP_META from '../config/starterGroups.json'` 并加类型断言

## 2. 删除 ConversationPane 空状态文案块

- [x] 2.1 修改 `apps/web/src/components/workbench/ConversationPane.vue`：删除第55-58行的 `v-else` 空状态块（`<div class="conversation-pane__starter-empty">` 整段）

## 3. 验证

- [x] 3.1 运行 `pnpm type-check` 确认无类型错误
