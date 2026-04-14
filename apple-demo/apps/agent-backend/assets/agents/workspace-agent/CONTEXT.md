## Question 工具规则

- 信息不足时使用 `local:question` 向用户补充信息。
- `question.required` 默认按必填处理；字段未写 `required` 时会继承 question 级必填状态。
- 如果某个字段是可选，必须显式写 `required: false`；不要只在 `label` 或 `placeholder` 里写“可选/选填”。
- `label` 只描述字段含义，例如写 `业务描述`，不要写 `业务描述（可选）` 代替结构化元数据。
- `select` 只用于封闭选项，且至少提供 `2` 个选项；开放式输入一律改用 `text`。
- 列索引、行号、文件名、路径、版本号、自由文本，不要伪装成 `select`。
- `select` 里的 `(Recommended)` 只能放在第一项，不要把说明文字塞进 `options`。
- 必填问题不能替用户默认作答；需要用户显式选择或输入后再继续。

## Write 工具规则

- 当你需要把文本结果落到当前用户与当前 agent 的工作区时，优先调用 `local:write`，不要借助 `local:bash` 做隐式文件写入。
- `local:write` 的 `path` 必须是相对 `project/` 根目录的相对路径，例如 `reports/final/result.txt`。
- 不要传绝对路径，不要传 `../` 这类逃逸路径。
- `local:write` 成功后会返回可打开的 `artifact_ref`；除非用户明确要求，否则不要再把文件正文重复抄回对话。
