## Why

当前 MML 校验模式会把规则表中的 `长度` 列解释为字符串参数的精确长度约束，并在文本编辑与表格编辑两条共享校验链路中生效。这会让本应按 `最小长度 + 最大长度` 判断的字符串参数被错误地要求“长度必须等于某个值”，导致规则语义与实际业务预期不一致。

## What Changes

- 调整 `web-backend` 的 MML 规则导入语义：
  - 对 Excel 规则中 `类型=字符串` 的参数，继续读取 `最小长度` 和 `最大长度`。
  - 对 Excel 规则中 `类型=字符串` 的参数，不再将 `长度` 列作为字符串精确长度约束写入 schema。
- 调整 `apps/web` 的 MML 参数校验行为：
  - 在字符串类型参数校验中，仅使用 `minLength` 和 `maxLength`。
  - 对已经存在历史 `exactLength` 值的字符串 schema，前端校验不再继续使用该值。
- 补充覆盖导入与前端校验的测试，确保新导入规则和历史存量规则都符合新的字符串长度校验模式。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `web-mml-rule-catalog`: 调整 Excel 规则导入后的字符串长度约束解释，要求字符串参数以 `最小长度` 与 `最大长度` 为准，而不是使用 `长度` 列形成精确长度约束。
- `agent-web-workbench`: 调整工作台 MML 文本/表格共享校验逻辑，要求字符串参数校验忽略历史 `exactLength` 并仅依据最小/最大长度边界判断。

## Impact

- Affected specs:
  - `openspec/specs/web-mml-rule-catalog/spec.md`
  - `openspec/specs/agent-web-workbench/spec.md`
- Affected backend:
  - `apps/web-backend/src/mmlRules/importer.ts`
  - 相关 MML importer/store 测试
- Affected frontend:
  - `apps/web/src/components/workbench/mmlSemantics.ts`
  - `apps/web/src/components/workbench/mmlWorkbook.ts`
  - 相关文本/表格校验测试
- 不涉及新增或升级第三方依赖。
- 不涉及顶层目录结构变更。
