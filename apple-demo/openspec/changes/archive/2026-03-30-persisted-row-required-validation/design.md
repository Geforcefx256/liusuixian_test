## Context

MML 表格视图使用两套路由处理编辑：
- **Spare 行**：`handleMmlSpareCellChange` → `materializeMmlDraftRow` → `incompleteRows` props → `syncReadonlyCells`
- **Persisted 行**：`handleMmlCellEdit` → 直接修改 content → workbook 重建

Spare 行的必选参数缺失通过 `incompleteRows`（`MmlIncompleteRowState`）传递到 grid 组件，在 `resolveSpareRowIssue` 中读取并应用红色底框。Persisted 行完全没有这个链路。

关键文件：
- `mmlWorkbook.ts`：行模型定义（`MmlWorkbookRow`, `MmlPersistedGridRow`）和构建逻辑（`buildMmlWorkbook`, `buildMmlGridSheet`）
- `MmlWorkbookGrid.vue`：grid 组件，`resolveSpareRowIssue` 和 `syncReadonlyCells`

## Goals / Non-Goals

**Goals:**
- Persisted 行删除必选参数值后，对应单元格显示红色底框（`mml-workbook-grid__cell--invalid`）和 tooltip（"缺少必选参数"）
- 与 spare 行的视觉效果保持一致
- 复用已有的 `resolveSpareRowIssue` + CSS 机制，不引入新的展示路径

**Non-Goals:**
- 不阻止用户删除必选参数（允许编辑，只是视觉提示）
- 不修改 `applyMmlCellEdit` 的语义（它仍然只做格式校验）
- 不为 persisted 行引入 `incompleteRows` 机制（两套路由保持独立）

## Decisions

### 1. 在 workbook 构建阶段计算 missingRequired，而非 grid 组件内实时计算

**选择**：在 `buildMmlWorkbook` 中对 persisted 行计算 `missingRequired` / `missingConditionalRequired`，通过行模型传递到 grid。

**理由**：
- `buildMmlWorkbook` 已有 schema 和 row values，计算代价极低
- Grid 组件不需要了解 schema 细节，只需读取预计算结果
- 与 spare 行的 `materializeMmlDraftRow` 使用相同的检测逻辑（`resolveRequiredMode` / `matchesConditionalRequirement`）

**备选方案**：在 grid 的 `syncReadonlyCells` 中实时对照 schema 检查 → 需要把 schema 传入 grid，增加组件复杂度，且每次 sync 都重复计算。

### 2. 扩展现有行模型类型，不新增独立数据结构

**选择**：在 `MmlWorkbookRow` 和 `MmlPersistedGridRow` 上增加 `missingRequired: string[]` 和 `missingConditionalRequired: string[]` 字段。

**理由**：
- 与 `MmlIncompleteRowState` 的字段名一致，方便复用 `resolveSpareRowIssue` 逻辑
- 数据随行模型流转，不需要额外的 props 或 store

### 3. 改造 resolveSpareRowIssue 为通用行检查函数

**选择**：将 `resolveSpareRowIssue` 改造为同时支持 spare 行和 persisted 行的检查函数。

**理由**：
- Persisted 行和 spare 行的红色底框展示逻辑完全相同（同一个 CSS class、同一个 tooltip 格式）
- 改名 + 扩展比对 persisted 行新增一条独立路径更简洁

## Risks / Trade-offs

- **[性能]** `buildMmlWorkbook` 在每次 content 变化时调用，新增的 required 检查遍历 schema params → 风险极低，schema params 数量有限，且原流程已有类似遍历
- **[一致性]** Persisted 行的 missingRequired 在 workbook 重建时才更新，与 spare 行的 incompleteRows 实时更新有微小延迟 → 可接受，因为 workbook 重建在 content 变化后立即触发
- **[条件必选]** 条件必选参数（`conditional_required`）的判断依赖其他参数的值，需要将 `matchesConditionalRequirement` 从 `materializeMmlDraftRow` 中提取为可复用函数
