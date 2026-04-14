## ADDED Requirements

### Requirement: Workbench editor header SHALL separate file navigation from editor actions
当工作台处于 workspace-expanded 状态并显示中央文件编辑壳层时，编辑器顶部 MUST 将“当前文件上下文”与“当前可执行动作”拆分为不同层级；文件名 MUST 仅由标签导航层承担，而工具栏 MUST 只承载视图切换、状态摘要与编辑动作，不得重复渲染独立的“当前文件”标题区块。

#### Scenario: 活动文件名只在标签导航层出现
- **WHEN** 用户在中央工作区打开任意文件且编辑器顶部可见
- **THEN** 顶部 MUST 显示包含活动文件名的标签导航层
- **AND** 工作台 MUST NOT 在标签导航层之外额外渲染独立的“当前文件”标题或重复文件名区块

#### Scenario: 工具栏不重复承担文件标题职责
- **WHEN** 用户查看活动文件上方的编辑器工具栏
- **THEN** 工具栏 MUST 继续提供视图切换、MML 解析状态、搜索、保存和编辑器级更多动作
- **AND** 工具栏 MUST NOT 为了标识当前文件而重复显示文件名

#### Scenario: 文件级操作入口独立于重复标题区块存在
- **WHEN** 用户查看活动文件对应的编辑器头部
- **THEN** 工作台 MUST 继续提供该活动文件的复制名称、重命名、下载和删除等文件级操作入口
- **AND** 该入口 MUST 不依赖单独的“当前文件”标题区块才能被访问

#### Scenario: 窄屏下仍保持双层职责
- **WHEN** 工作台在较窄宽度下渲染文件编辑壳层头部
- **THEN** 标签导航层与工具栏层 MAY 发生换行或堆叠
- **AND** 工作台 MUST 继续保持文件名只由标签导航层承担
- **AND** 工作台 MUST NOT 因响应式布局而恢复重复的“当前文件”标题区块
