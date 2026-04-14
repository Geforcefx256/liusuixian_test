## MODIFIED Requirements

### Requirement: Authenticated workbench SHALL default to a conversation-first base shell
系统 SHALL 为已认证用户渲染一个持久化的基础工作台壳层，其中包含统一的主身份头部、中央会话区域和可见的右侧工作空间侧栏，而不再需要单独的首页模式或独立的左侧历史 rail 列。

#### Scenario: 用户在没有持久化活动会话时进入工作台
- **WHEN** 已认证用户打开工作台且当前没有选中的持久化会话
- **THEN** 前端 MUST 仍然渲染标准工作台壳层
- **AND** 中央视图 MUST 呈现空会话状态，而不是跳转到独立首页
- **AND** 右侧工作空间侧栏 MUST 在该空会话状态下保持可见

#### Scenario: 常规会话期间不会打开工作空间区域
- **WHEN** 用户正在查看基础工作台壳层且尚未打开任何工作空间文件
- **THEN** 前端 MUST 保持会话区域作为中央主面板
- **AND** 前端 MUST NOT 仅因为存在会话就展示中央工作空间编辑区

#### Scenario: 基础壳层不再预留左侧历史 rail 列
- **WHEN** 用户在已认证的桌面布局中查看标准工作台壳层
- **THEN** 前端 MUST NOT 渲染专用的左侧历史 rail 或仅靠 hover 触达的历史入口区域
- **AND** 会话历史访问入口 MUST 改为从统一主身份头部中的显式控件进入

### Requirement: Workbench SHALL manage draft conversations, persisted sessions, and history rail actions distinctly
系统 SHALL 区分空白会话草稿与后端持久化会话，并通过统一主身份头部启动的显式历史管理界面呈现会话历史；该界面包含可搜索的会话条目、会话切换和单条删除能力，同时移除低价值 preview 摘要与批量清空入口。

#### Scenario: 新建会话返回空白会话壳层
- **WHEN** 用户从统一主身份头部触发新建会话动作
- **THEN** 前端 MUST 清除当前已选中的持久化会话
- **AND** 工作台 MUST 回到标准工作台壳层中的空白会话状态
- **AND** 前端 MUST NOT 在用户发送该草稿的第一条消息前创建后端会话

#### Scenario: 第一条消息会创建持久化会话
- **WHEN** 用户从空白会话状态发送第一条消息
- **THEN** 前端 MUST 在开始流式运行前为当前 agent 创建后端会话
- **AND** 新会话 MUST 在显式历史管理界面中可见

#### Scenario: 历史动作打开显式管理界面
- **WHEN** 用户从统一主身份头部触发 `历史会话` 动作
- **THEN** 工作台 MUST 在该历史图标下方打开产品内的下拉历史管理界面，而不是依赖 hover 进入
- **AND** 打开该界面 MUST NOT 要求工作台为历史功能预留永久性的左侧布局列

#### Scenario: 历史管理界面支持显式关闭
- **WHEN** 历史管理界面已经打开且用户点击外部区域、按下 `Esc`，或选中一条会话
- **THEN** 历史管理界面 MUST 关闭
- **AND** 该关闭过程 MUST NOT 触发额外的会话创建或删除请求

#### Scenario: 历史管理界面被简化为搜索、列表和删除
- **WHEN** 显式历史管理界面处于打开状态
- **THEN** 工作台 MUST 展示带有会话标题和更新时间元数据的可搜索会话列表
- **AND** 工作台 MUST 允许用户在该界面中选择会话或请求删除某条会话
- **AND** 工作台 MUST NOT 在该界面中渲染逐条会话 preview 文本或批量清空历史入口
- **AND** 搜索行为 MUST 保持现状，不因 preview 在界面隐藏而改变匹配方式

#### Scenario: 历史管理界面保留当前会话高亮
- **WHEN** 用户打开显式历史管理界面且当前存在活动会话
- **THEN** 工作台 MUST 在历史列表中保持该当前会话的高亮选中状态
- **AND** 用户 MUST 能通过该高亮快速识别自己正在查看的会话

#### Scenario: 历史管理界面内容区从左侧平铺展开
- **WHEN** 工作台在 header 下方渲染显式历史管理界面
- **THEN** 该界面的搜索区和列表区 MUST 从面板左侧边界开始平铺展开
- **AND** 工作台 MUST NOT 将该界面渲染为仅围绕触发按钮展开的窄气泡样式

#### Scenario: 选择会话后关闭历史管理界面
- **WHEN** 用户从显式历史管理界面中选择某条会话
- **THEN** 前端 MUST 将活动会话切换为该选中的会话
- **AND** 历史管理界面 MUST 在选择生效后关闭

#### Scenario: 删除会话仍然需要确认
- **WHEN** 用户在显式历史管理界面中选择删除某条会话
- **THEN** 前端 MUST 在发起删除前请求显式确认
- **AND** 确认后的删除 MUST 将该会话从可见历史列表中移除

### Requirement: Workbench SHALL keep agent identity and visual language consistent across base and expanded shells
系统 SHALL 在基础会话壳层和工作空间展开壳层之间保持一致的智能体身份表达与视觉语言，通过将产品 logo 与后端驱动的小曼智能体身份合并为一个主头部表达来实现，同时继续保持最小可用工作空间范围。

#### Scenario: 统一主头部融合产品与小曼身份
- **WHEN** 用户在空白会话状态或活动持久化会话状态下查看工作台
- **THEN** 壳层 MUST 展示一个统一的主身份区域，将产品 logo 与当前 agent 身份合并在一起
- **AND** 产品 logo MUST 继续作为图形主标识保留在该区域中
- **AND** 该区域中的可见 agent 标题 MUST 继续由后端驱动的 agent 元数据解析，而不是由前端硬编码名称提供

#### Scenario: 主会话动作紧邻统一身份区域
- **WHEN** 壳层渲染主 `新建会话` 和 `历史会话` 动作时
- **THEN** 这些动作 MUST 与统一主身份区域一同出现在顶层 header 带中
- **AND** 工作台 MUST NOT 再为这些动作预留单独的左侧 rail

#### Scenario: 工作空间展开态保持相同的会话与品牌语言
- **WHEN** 用户打开工作空间展开态
- **THEN** 壳层 MUST 保持与基础工作台一致的顶层品牌和会话输入区视觉语言
- **AND** 该调整 MUST NOT 重新引入沉重的独立落地卡片或状态卡式工作空间面板
- **AND** 工作台 MUST NOT 在统一 header 下方的会话面板内部再次渲染第二条堆叠的小曼身份栏

#### Scenario: Pane 自有滚动防止页面级溢出
- **WHEN** 工作台内容超过可用视口高度
- **THEN** 页面本身 MUST 避免为整个工作台壳层出现全局纵向滚动条
- **AND** 历史管理界面、会话区域、工作空间区域和工作空间侧栏 MUST 按需使用各自的 pane 内滚动

### Requirement: Workbench SHALL allow user-resizable pane widths in the desktop shell
已认证工作台 SHALL 允许用户在桌面布局中手动调整会话面板、工作空间编辑面板和右侧工作空间侧栏的宽度，同时为各个 pane 保留最小可用宽度。由于历史功能不再建模为永久 pane，壳层 MUST NOT 暴露独立的左侧历史 rail 宽度调整边界。

#### Scenario: 用户调整会话面板与编辑器边界
- **WHEN** 工作台处于工作空间展开态且用户拖动会话面板与工作空间编辑器之间的分隔条
- **THEN** 工作台 MUST 在受治理的最小宽度范围内调整这两个 pane 的宽度
- **AND** 当达到最小宽度限制时，编辑器 MUST 仍然保持最高优先级

#### Scenario: 用户调整编辑器与工作空间侧栏边界
- **WHEN** 工作台处于工作空间展开态且用户拖动工作空间编辑器与工作空间侧栏之间的分隔条
- **THEN** 侧栏宽度 MUST 在受治理的最小值和最大值之间更新
- **AND** `工作空间` 与 `模板` 标签 MUST 在支持的桌面宽度下保持可读且不换行

#### Scenario: 受限宽度下仍然安全回退
- **WHEN** 视口宽度变窄到无法同时满足所有受治理的最小宽度
- **THEN** 工作台 MUST 优先保留编辑器可用性，再牺牲工作空间侧栏
- **AND** 现有的侧栏让位或折叠行为 MAY 继续作为回退手段使用

### Requirement: Workbench SHALL keep history-management actions aligned with per-session activity state
工作台 SHALL 在显式历史管理界面中反映共享工作区占用状态，使用户能够定位当前运行所属会话，并在该占用状态持续期间禁止危险的会话删除动作。

#### Scenario: 历史管理界面识别活动运行所属会话
- **WHEN** 共享工作区存在一个活动运行，且用户当前正在查看另一个会话
- **THEN** 显式历史管理界面 MUST 标识当前哪个会话拥有该活动运行
- **AND** 用户 MUST 能在不丢失 owner 标识的前提下返回该所属会话

#### Scenario: 共享工作区被占用时删除会话不可用
- **WHEN** 当前共享工作区中的任意会话存在活动运行或未解决的 pending question
- **THEN** 工作台 MUST 在显式历史管理界面中将逐条会话删除动作渲染为不可用
- **AND** 工作台 MUST NOT 在该占用状态持续期间发起删除请求

## REMOVED Requirements

### Requirement: History rail bulk-clear action SHALL remain activatable through menu interactions
**Reason**: 工作台移除了左侧历史 rail，并将默认历史管理界面收敛为搜索、列表和逐条删除，因此不再从默认历史管理入口暴露 `清空历史会话`。
**Migration**: 改用历史管理界面中的逐条删除能力。后端批量清空契约可以继续作为内部能力保留，但默认工作台体验 MUST NOT 再依赖该入口。
