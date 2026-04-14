# Tasks: MML 汇总页面命令搜索

## 任务列表

- [x] **T1: 新增搜索状态与过滤逻辑**
  - 在 `WorkspaceEditorPane.vue` 的 `<script>` 中新增 `mmlSummarySearchQuery` ref 和 `filteredMmlSheets` computed
  - computed 对 `commandHead` 做大小写不敏感的 includes 匹配
  - 文件：`apps/web/src/components/workbench/WorkspaceEditorPane.vue`

- [x] **T2: 模板改造 — 插入搜索框并替换 v-for 数据源**
  - 在 hero 区域与 card grid 之间插入 `<input>` 搜索框，v-model 绑定 `mmlSummarySearchQuery`
  - card grid 的 `v-for` 从 `mmlWorkbook.sheets` 改为 `filteredMmlSheets`
  - 新增无匹配时的空状态提示："未找到匹配的命令"
  - 保留原有无 sheet 时的空状态不变
  - 文件：`apps/web/src/components/workbench/WorkspaceEditorPane.vue`

- [x] **T3: 搜索框样式**
  - 新增 `.workspace-editor__mml-summary-search` 样式，与 hero/card 视觉一致（圆角、边框、背景）
  - 文件：`apps/web/src/components/workbench/WorkspaceEditorPane.vue`（`<style>` 部分）
