## 1. 数据模型扩展

- [x] 1.1 在 `MmlWorkbookRow`（mmlWorkbook.ts）上增加 `missingRequired: string[]` 和 `missingConditionalRequired: string[]` 字段
- [x] 1.2 在 `MmlPersistedGridRow` 上增加相同字段
- [x] 1.3 在 `buildMmlGridSheet` 中将 `MmlWorkbookRow` 的这两个字段透传到 `MmlPersistedGridRow`

## 2. 必选参数检测逻辑

- [x] 2.1 将 `materializeMmlDraftRow` 中的 `resolveRequiredMode` 提取为顶层导出函数（当前已是顶层函数，确认可复用）
- [x] 2.2 将 `matchesConditionalRequirement` 提取为顶层导出函数
- [x] 2.3 在 `buildMmlWorkbook` 构建 persisted row 时，对照 schema 计算 `missingRequired` 和 `missingConditionalRequired`，赋值到行模型

## 3. Grid 展示改造

- [x] 3.1 改造 `resolveSpareRowIssue` 为同时支持 persisted 行和 spare 行的通用检查函数（如 `resolveCellIssue`）
- [x] 3.2 对 persisted 行，从 `MmlPersistedGridRow.missingRequired` / `missingConditionalRequired` 读取缺失信息，返回对应的提示文本
- [x] 3.3 确保 `syncReadonlyCells` 中对 persisted 行也调用改造后的检查函数并应用 `mml-workbook-grid__cell--invalid` class

## 4. 测试

- [x] 4.1 在 `mmlWorkbook.test.ts` 中增加 persisted 行必选参数缺失检测的单元测试
- [x] 4.2 在 `MmlWorkbookGrid.test.ts` 中增加 persisted 行删除必选参数后红色底框展示的测试
