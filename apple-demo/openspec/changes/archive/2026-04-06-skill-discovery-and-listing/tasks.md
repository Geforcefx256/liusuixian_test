## 1. 建立 listing reminder 构建链

- [x] 1.1 新增 build/executor 专用的 skill listing builder，基于 `availableSkills` 生成仅包含 `name`、`description`、`whenToUse` 的 reminder 文本，并在内部诊断结果中保留 `discoveryMode: disabled`
- [x] 1.2 为 listing builder 增加总 budget 与单条 budget 的 deterministic trimming 规则，确保保留 skill 名称并能显式区分 trimmed / skipped

## 2. 收敛 runtime 暴露面

- [x] 2.1 将 listing reminder 以 conversation reminder message 的形式注入 build/executor 的模型调用链，且保持 planner 路径不变
- [x] 2.2 将 `skill` tool 描述改为静态使用说明，移除内联 skill catalog，并保持完整 `SKILL.md` 继续通过既有 `skill:skill` 路径加载

## 3. 增加日志与验证

- [x] 3.1 增加结构化日志，至少覆盖 `skill_listing_built`、`skill_listing_entry_trimmed`、`skill_listing_injected`，并包含预算与 discovery mode 字段
- [x] 3.2 补充测试，验证 listing 只暴露约定摘要字段、budget trimming/skip 行为可预测、`skill` tool 描述不再内联 catalog
- [x] 3.3 补充测试，验证 build/executor reminder 注入路径与 `discoveryMode: disabled` 的日志语义成立、该字段不再暴露给模型侧 reminder 文本，且未授权 skill 仍不能通过 `skill:skill` 加载
