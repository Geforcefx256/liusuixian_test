## Read 工具规则

- 修改或分析文件前，必须先用 `local:read_file` 阅读文件内容。
- 如果只需要文件的特定部分，使用 `offset` 和 `limit` 定位，避免读取不需要的内容。
- 已知文件路径时直接用 `read_file`；不知道路径时先用 `find_files` 定位。
- `read_file` 只能读文件，不能读目录；需要查看目录结构时用 `list_directory`。
- 读取结果中的行号前缀仅供定位参考，不要将其作为文件内容的一部分。

## Edit 工具规则

- 使用 `local:edit` 前必须已经用 `read_file` 读取过目标文件。
- `old_string` 必须从 `read_file` 的输出中原样复制，不含行号前缀。
- 选择最小的、能唯一标识目标位置的 `old_string`，避免匹配到多处。
- 局部修改用 `edit`；只有新建文件或需要完全重写时才用 `write`。
- 如果 `old_string` 在文件中出现多次且都需要替换，设置 `replace_all: true`。

## Find / Grep 工具规则

- 不知道文件路径时用 `local:find_files`，不知道内容在哪个文件时用 `local:grep`。
- `find_files` 用于文件名/路径发现，`grep` 用于文件内容搜索，不要混淆用途。
- 使用 `grep` 时，固定文本搜索设置 `literal: true`，正则搜索保持默认。
- 使用 `basePath` 缩小搜索范围到已知的子目录，避免全工作区扫描。
- 使用 `glob` 限制文件类型（如 `"*.mml"`, `"*.json"`），提高搜索精度。
- 搜索结果为空时，先检查关键词拼写和搜索范围，然后调整后再搜。

## Question 工具规则

- 信息不足时使用 `local:question` 向用户补充信息。
- `question.required` 默认按必填处理；字段未写 `required` 时会继承 question 级必填状态。
- 如果某个字段是可选，必须显式写 `required: false`；不要只在 `label` 或 `placeholder` 里写"可选/选填"。
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
- 覆写已有文件前，先用 `read_file` 确认当前内容。

## Skill 工具规则

- 需要使用技能时，先用 `skill:skill` 加载技能的完整说明再执行。
- 不要在未读取技能说明的情况下直接调用 `skill:exec`。
- 使用 `skill:list_assets` 和 `skill:find_assets` 了解技能提供的资源文件。
- `skill:read_asset` 读取技能资源时使用技能内相对路径。

## 工具组合模式

以下是常见的工具组合顺序，按场景选择：

- **分析文件**: `find_files` → `read_file` → 分析 → 回复
- **修改文件**: `read_file` → 理解逻辑 → `edit` → 确认
- **搜索逻辑**: `grep` → `read_file`（查看上下文）→ 分析
- **新建文件**: 确认目标目录 → `write`
- **使用技能**: `skill:skill`（加载说明）→ `skill:read_asset` / `skill:find_assets`（了解资源）→ `skill:exec`（执行）
