## 1. 实现混合分词函数

- [x] 1.1 在 `apps/agent-backend/src/agent/workspace/planner.ts` 中新增 `tokenize(input: string): string[]` 函数，实现语种边界拆分 + 中文 bigram 滑窗逻辑
- [x] 1.2 将 `scoreSkill()` 中的 `input.split(/\s+/)` 替换为 `tokenize(input)`，保持评分逻辑不变

## 2. 验证

- [x] 2.1 验证典型用例的匹配行为：纯中文（"读取存量mml配置"）、纯英文（"read mml config"）、中英混合（"查询mml命令"），确认候选 skill 列表包含预期 skill
- [x] 2.2 通过 `pnpm type-check` 确认类型无误
