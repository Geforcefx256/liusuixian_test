# Proposal: Persisted Row Required Validation

## Why

MML 表格视图中，spare 行（空白行）在必选参数未填时会显示红色底框提示（`mml-workbook-grid__cell--invalid`），但 persisted 行（已有语句的行）在用户删除必选参数值后不会显示任何提示。

这是因为验证链路仅在 spare 行流程中建立（`materializeMmlDraftRow` → `incompleteRows` → `resolveSpareRowIssue`），而 persisted 行的编辑路径（`handleMmlCellChange` → `applyMmlCellEdit`）完全不检查必选参数，且 `resolveSpareRowIssue` 对 persisted 行直接返回空字符串。

用户在 persisted 行上删除必选参数后，语句仍然合法（只是少了参数），workbook 重建无异常，导致红色底框永远不会出现。

## What

在 persisted 行上建立与 spare 行一致的必选参数缺失检测和红色底框展示机制。

- 在 workbook 构建阶段（`buildMmlWorkbook` / `buildMmlGridSheet`），对 persisted 行的 values 对照 schema 检查 missingRequired 和 missingConditionalRequired，将结果带到行模型中
- 在展示层（`syncReadonlyCells` / `resolveSpareRowIssue`）读取 persisted 行的缺失信息，对缺失必选参数的单元格应用红色底框样式
- 红色底框的 tooltip 应与 spare 行保持一致（"R{行号} {参数名} · 缺少必选参数"）

## Capabilities

### New Capabilities

- `persisted-row-required-check`: 对 persisted 行检测并展示必选参数缺失的红色底框提示

### Modified Capabilities

（无已有 spec 需要修改）

## Impact

- `app/web/src/components/workbench/mmlWorkbook.ts`: `buildMmlWorkbook` / `buildMmlGridSheet` 需要为 persisted 行计算 missingRequired；`MmlWorkbookRow` / `MmlPersistedGridRow` 类型需增加缺失信息字段
- `app/web/src/components/workbench/MmlWorkbookGrid.vue`: `resolveSpareRowIssue` 需要支持 persisted 行的缺失检查；`syncReadonlyCells` 需要对 persisted 行应用红色底框
- 相关测试文件需要覆盖 persisted 行删除必选参数的场景
