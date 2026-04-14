## ADDED Requirements

### Requirement: Web 后端 SHALL 规范化字符串参数的长度约束
Web 后端在从 Excel 工作簿导入 MML 规则并生成 schema 时，针对 `类型=字符串` 的参数 SHALL 仅使用 `最小长度` 与 `最大长度` 形成字符串长度边界，且 MUST NOT 将 `长度` 列解释为该参数的精确长度约束。

#### Scenario: 字符串参数同时存在长度边界和长度列时忽略精确长度
- **WHEN** `web-backend` 导入一个 `类型=字符串` 的规则行，且该行同时包含 `最大长度`、`最小长度` 和 `长度`
- **THEN** 生成后的 schema MUST 为该参数保留 `minLength` 和 `maxLength`
- **AND** 该参数的 `exactLength` MUST 为空或缺失，而不是使用 Excel `长度` 列的值

#### Scenario: 字符串参数只有长度列时不伪造边界
- **WHEN** `web-backend` 导入一个 `类型=字符串` 的规则行，且该行只包含 `长度` 列而没有 `最大长度` 或 `最小长度`
- **THEN** 生成后的 schema MUST NOT 为该字符串参数写入 `exactLength`
- **AND** 服务 MUST NOT 仅根据 `长度` 列伪造 `minLength` 或 `maxLength`
