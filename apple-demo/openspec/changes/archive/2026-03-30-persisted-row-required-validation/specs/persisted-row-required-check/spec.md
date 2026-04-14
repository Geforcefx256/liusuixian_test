## ADDED Requirements

### Requirement: Persisted 行必选参数缺失检测
系统 SHALL 在 `buildMmlWorkbook` 构建 persisted 行时，对照 schema 检查该行的 values 中是否存在未填写的必选参数（`requiredMode: 'required'`）和条件必选参数（`requiredMode: 'conditional_required'`），并将结果存储在行模型的 `missingRequired` 和 `missingConditionalRequired` 字段中。

#### Scenario: Persisted 行删除必选参数后检测到缺失
- **WHEN** persisted 行的某个必选参数值被用户清空（如 `NAME` 的值被删除）
- **THEN** `buildMmlWorkbook` 重建后，该行的 `missingRequired` SHALL 包含 `'NAME'`

#### Scenario: Persisted 行必选参数都已填写
- **WHEN** persisted 行的所有必选参数都有值
- **THEN** 该行的 `missingRequired` SHALL 为空数组

### Requirement: Persisted 行缺失参数的红色底框展示
系统 SHALL 对 persisted 行中缺失必选参数的单元格应用与 spare 行相同的红色底框样式（`mml-workbook-grid__cell--invalid` class），并在 tooltip 中显示对应的提示文本。

#### Scenario: Persisted 行必选参数缺失时显示红色底框
- **WHEN** persisted 行的某个必选参数缺失
- **THEN** 该参数对应的单元格 SHALL 具有 `mml-workbook-grid__cell--invalid` class，且 `title` 属性 SHALL 包含 `"缺少必选参数"` 文本

#### Scenario: Persisted 行条件必选参数缺失时显示红色底框
- **WHEN** persisted 行的某个条件必选参数缺失
- **THEN** 该参数对应的单元格 SHALL 具有 `mml-workbook-grid__cell--invalid` class，且 `title` 属性 SHALL 包含 `"缺少条件必选参数"` 文本

#### Scenario: Spare 行红色底框行为不变
- **WHEN** spare 行存在 incompleteRows 状态
- **THEN** 红色底框展示行为 SHALL 与改造前完全一致

### Requirement: 行模型类型扩展
`MmlWorkbookRow` 和 `MmlPersistedGridRow` SHALL 增加 `missingRequired: string[]` 和 `missingConditionalRequired: string[]` 字段。`buildMmlGridSheet` SHALL 将 `MmlWorkbookRow` 的这两个字段透传到 `MmlPersistedGridRow`。

#### Scenario: PersistedGridRow 包含缺失信息
- **WHEN** 某个 `MmlWorkbookRow` 的 `missingRequired` 为 `['NAME']`
- **THEN** `buildMmlGridSheet` 生成的对应 `MmlPersistedGridRow` 的 `missingRequired` SHALL 也为 `['NAME']`
