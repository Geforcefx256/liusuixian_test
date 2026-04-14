## MODIFIED Requirements

### Requirement: 工作台编辑器 SHALL 将 MML 呈现为 txt 文件的一种可选解析模式
工作台编辑器 SHALL 将 MML 呈现为受支持 `txt` 文件的一种可选解析模式，而不是永久性的面向用户文件类型；当用户进入 MML 表格视图流程时，编辑器 SHALL 暴露由后端驱动的 `网元类型` 和 `网元版本` 选择控件。

#### Scenario: txt 文件在启用前展示 MML 解析入口
- **WHEN** 用户在工作台展开态中打开一个受支持的 `txt` 文件
- **THEN** 编辑器头部 MUST 显示一个面向用户的 `按 MML 解析` 入口
- **AND** 在该入口出现之前，编辑器 MUST NOT 要求文件已经被标记为 `MML`

#### Scenario: 启用 MML 解析后展示可选配置
- **WHEN** 用户展开一个受支持 `txt` 文件的 `按 MML 解析` 入口
- **THEN** 编辑器 MUST 在二级配置区域中展示可选择的 `网元类型` 和 `网元版本` 控件
- **AND** 这些控件 MUST 使用后端提供的候选数据，而不是开放式自由文本输入
- **AND** 主工具栏 MUST 将这两个字段保持在常驻主行之外

#### Scenario: MML 选择控件默认值为请选择
- **WHEN** 编辑器首次为一个尚未完成 MML 配置的文件展示 `网元类型` 和 `网元版本` 选择控件
- **THEN** 每个控件 MUST 将 `请选择` 作为默认显示值
- **AND** 在用户完成这两个选择之前，编辑器 MUST 将该文件视为尚未准备好进入基于 schema 的表格视图

#### Scenario: 表格视图阻塞状态使用面向任务的文案
- **WHEN** 用户在 MML 解析尚未准备好时尝试进入表格视图
- **THEN** 编辑器 MUST 使用面向任务的文案解释阻塞状态，例如缺少配置或暂不支持解析
- **AND** 在这些用户可见文案中，编辑器 MUST NOT 暴露诸如 `Schema` 之类的实现术语

#### Scenario: Markdown 文件不展示 MML 解析入口
- **WHEN** 用户在展开态工作台中打开一个 Markdown 工作区文件
- **THEN** 编辑器 MUST NOT 为该文件显示 `按 MML 解析` 入口

### Requirement: 工作台 SHALL 在 MML 表格视图中暴露 schema 加载状态
工作台 SHALL 使用当前 `网元类型` 和 `网元版本` 加载 MML 命令参数 schema，并且在 MML 表格视图中通过后端驱动的下拉选择保持这两个值可配置。

#### Scenario: 表格视图展示后端驱动的类型和版本下拉框
- **WHEN** 用户将一个支持 MML 的文件切换到表格视图
- **THEN** 工作台 MUST 在该流程中以 dropdown 样式控件暴露 `网元类型` 和 `网元版本`
- **AND** 这两个控件的候选值 MUST 来自后端提供的选项数据

#### Scenario: 可用 schema 启用基于 schema 的列定义
- **WHEN** 当前 MML 元数据能够解析到一个可用的 schema 响应
- **THEN** 表格视图 MUST 使用该 schema 来决定已知参数列、列顺序、控件类型和可编辑性
- **AND** 工作台 MUST 向用户显式呈现该 schema 已就绪状态

#### Scenario: schema 缺失或失败时表格保持可读但不可编辑
- **WHEN** 当前活动 MML 元数据的 schema 加载不可用或失败
- **THEN** 在解析成功的前提下，工作台 MUST 保持结构化表格投影可读
- **AND** 工作台 MUST 将表格编辑降级为只读，而不是猜测基于 schema 的编辑行为
