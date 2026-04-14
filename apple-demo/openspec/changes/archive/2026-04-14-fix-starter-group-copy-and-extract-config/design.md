## Context

快速开始分组数据（`STARTER_GROUP_META`）目前以 TypeScript 常量形式硬编码在 `apps/web/src/stores/workbenchStore.ts` 中。该数据同时驱动 `ConversationPane.vue` 和 `HomeStage.vue` 两个组件的快速开始卡片展示。文案修改需改动业务逻辑文件，职责耦合，且当前 subtitle 存在错别字与表意不准。

## Goals / Non-Goals

**Goals:**
- 修正三条 subtitle 的错别字（选则→选择）及文案（场景→Skill）
- 删除 ConversationPane 中无 skill 时的空状态文案块
- 将 STARTER_GROUP_META 提取为独立 JSON 文件，使文案与逻辑解耦

**Non-Goals:**
- 不引入 i18n 框架或多语言支持
- 不修改 HomeStage.vue 的空状态行为（fallback 按钮保持现状）
- 不改变 STARTER_GROUP_META 的数据结构或字段定义

## Decisions

### 决策 1：JSON 文件放置位置
**选择**：`apps/web/src/config/starterGroups.json`

**理由**：`config/` 目录语义明确（前端静态配置），与 `stores/`（状态管理逻辑）职责分离。Vite 原生支持 JSON import，无需额外依赖。

**备选方案**：放在 `stores/` 同级或 `assets/` 下——前者职责仍混淆，后者语义偏向静态资源。

### 决策 2：workbenchStore.ts 的改动方式
**选择**：直接 `import STARTER_GROUP_META from '../config/starterGroups.json'`，并为 import 结果添加类型断言（`as Array<...>`）保留类型安全。

**理由**：改动最小，不影响下游消费 STARTER_GROUP_META 的任何代码路径；TypeScript 的 `resolveJsonModule` 在当前 tsconfig 中已启用（Vite 项目默认）。

### 决策 3：ConversationPane 空状态的处理方式
**选择**：删除整个 `v-else` 块（第55-58行），无 skill 时区域留空。

**理由**：用户明确要求"不显示任何内容"；保留空 `div` 无意义且增加 DOM 噪音。`emptyTitle` / `emptyDescription` 字段仍保留在 JSON 中（HomeStage 的 fallback 按钮仍使用它们）。

## Risks / Trade-offs

- [风险] TypeScript 对 JSON import 的类型推断为字面量类型，可能与 `StarterGroupView` 类型不完全兼容 → 缓解：在 import 处加显式类型断言
- [权衡] `emptyTitle` / `emptyDescription` 字段仍保留在 JSON 中但 ConversationPane 不再使用，存在死字段 → 可接受：HomeStage fallback 按钮仍引用这两个字段，字段未完全失效

## Migration Plan

1. 新建 `apps/web/src/config/starterGroups.json`，内容从 `workbenchStore.ts` 中复制并修正文案
2. 修改 `workbenchStore.ts`：移除常量定义，改为 import JSON
3. 修改 `ConversationPane.vue`：删除 `v-else` 空状态块
4. 运行 `pnpm type-check` 验证类型无误
5. 无部署风险，无需回滚策略（纯前端静态重构）
