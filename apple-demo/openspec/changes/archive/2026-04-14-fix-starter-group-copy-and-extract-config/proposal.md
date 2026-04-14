## Why

对话卡片（ConversationPane）和首页（HomeStage）的快速开始区域存在错别字（"选则"）、文案表意不准确，以及空状态下显示无意义提示文字的问题。同时，驱动这两个组件的 `STARTER_GROUP_META` 数据硬编码在 `workbenchStore.ts` 中，业务文案修改需要改动逻辑文件，职责不分离。

## What Changes

- **修复 subtitle 错别字及文案**：将三条 subtitle 中的"选则"改为"选择"，"场景/业务场景"改为"Skill"，使表述更准确：
  - `选择Skill快速开始生成配置方案`
  - `选择Skill快速开始生成MML配置`
  - `选择Skill快速开始核查`
- **删除空状态提示块**：`ConversationPane.vue` 中当 group 无 skill 时显示的 `v-else` 文案块（emptyTitle + emptyDescription）直接移除，无 skill 时该区域留空。
- **提取 STARTER_GROUP_META 为 JSON**：将 `workbenchStore.ts` 中的常量迁移至 `apps/web/src/config/starterGroups.json`，store 改为 import 该 JSON，文案与逻辑解耦。

## Capabilities

### New Capabilities

- `starter-group-config`: 快速开始分组配置的外置 JSON 管理——将 title、subtitle、icon、discoveryQuery、emptyTitle、emptyDescription 字段统一存放在可独立编辑的配置文件中。

### Modified Capabilities

- `agent-web-workbench`: 工作台快速开始区域的空状态展示行为变更（无 skill 时不再显示任何提示文案）。

## Impact

- `apps/web/src/stores/workbenchStore.ts`：移除 `STARTER_GROUP_META` 常量，改为 import JSON
- `apps/web/src/config/starterGroups.json`：新增文件（不涉及第三方依赖，不触动顶层目录结构）
- `apps/web/src/components/workbench/ConversationPane.vue`：删除空状态 `v-else` 块
- 无 API 变更，无依赖版本变更，无破坏性接口改动
