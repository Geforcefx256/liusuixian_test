# agent-web-workbench Specification

## Purpose
TBD - created by archiving change build-vue-agent-workbench-lite. Update Purpose after archive.
## Requirements
### Requirement: Workbench MUST initialize from backend agent metadata
The system SHALL load governed agent metadata from the backend so that the workbench shell, starter framework, skill discovery surfaces, and user-visible Agent naming are driven by backend-provided Agent metadata rather than raw prototype constants, raw asset catalog order, or frontend hardcoded naming.

#### Scenario: Governed metadata populates the home shell
- **WHEN** the frontend loads the selected agent detail successfully
- **THEN** the workbench MUST use backend-provided governed agent identity and managed skill metadata to populate the home-stage header and starter framework

#### Scenario: Runtime bootstrap configures governed session behavior
- **WHEN** the frontend loads runtime bootstrap for the active agent
- **THEN** the frontend MUST use that bootstrap payload to initialize the session experience and governed runtime context
- **AND** the governed skill surface in the bootstrap MUST match the skills that can be executed for that agent surface

#### Scenario: User-visible Agent name is not frontend-hardcoded
- **WHEN** the workbench renders the current Agent identity in a user-visible surface
- **THEN** the displayed Agent title MUST resolve from backend-provided Agent metadata
- **AND** the frontend MUST NOT replace that title with a frontend-hardcoded name for the same agent

#### Scenario: Governed skill update refreshes active workbench metadata
- **WHEN** an administrator successfully saves managed skill governance for the currently selected agent inside the same workbench shell
- **THEN** the frontend MUST refresh the governed agent metadata used by starter and search surfaces
- **AND** the workbench MUST NOT continue rendering stale governed skill names for that active agent until a manual page reload

### Requirement: Workbench skill discovery SHALL hide raw skill bodies from end users
The workbench SHALL let end users discover and use governed skills while restricting visibility to governed descriptions and agent-scoped user-visible skill names.

#### Scenario: Search shows governed skill descriptions only
- **WHEN** a user searches for available skills from the workbench
- **THEN** the search results MUST use the governed visible skill set for the current user and active agent
- **AND** each result MUST show the governed skill name and descriptive metadata without exposing the raw `SKILL.md` body

#### Scenario: Hidden experimental skills do not appear in production discovery
- **WHEN** a skill is not visible on the production surface for the current user or agent
- **THEN** the workbench MUST exclude that skill from starter cards and default skill search results

#### Scenario: Hot skills use governed display names
- **WHEN** the workbench shows the default `热门技能` suggestions with no active search query
- **THEN** each suggestion MUST use the governed user-facing skill name for the current agent surface
- **AND** the workbench MUST NOT fall back to rendering the raw skill id as a normal display label

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

### Requirement: Workbench SHALL provide a persistent workspace sidebar and a minimal workspace-open shell
The system SHALL treat the right-side work area as a persistent workspace sidebar for the current `user + agent` workspace and SHALL open a central file review-and-correction shell for supported files while keeping the conversation surface visible and conversation-led, including runtime-written output files that join the same workspace. The workspace tab MUST distinguish uploaded user materials from active project files and folders while presenting those groups to the user as `upload` and `project`. In the workspace-expanded state, the sidebar MUST support true manual collapse and explicit re-expansion without closing the active workspace file, and constrained-width behavior MUST preserve a usable sidebar header and predictable visibility controls without requiring a separate persistent shared-workspace title row above the tree. The workspace sidebar MUST preserve a predictable sidebar-local vertical scrolling region for long file lists so that all file entries remain reachable without page-level scrolling.

#### Scenario: Workspace sidebar is visible during normal conversation
- **WHEN** the user is in the base workbench shell
- **THEN** the right side MUST show a workspace sidebar rather than status-summary cards
- **AND** that sidebar MUST expose peer tabs for `工作空间` and `模板`
- **AND** the workspace tab MUST NOT render a workspace-scoped upload entry point in the sidebar

#### Scenario: Workspace grouping does not reuse session naming or require a separate title row
- **WHEN** the user views the right-side workspace sidebar while switching between sessions for the same agent
- **THEN** the workspace grouping MUST continue to represent the current `user + agent` workspace
- **AND** the sidebar MUST NOT present the selected session title as a workspace title
- **AND** the sidebar MUST NOT render a separate persistent title row such as `共享工作区` above the file tree

#### Scenario: Workspace groups use `upload` and `project` labels
- **WHEN** the workbench renders grouped workspace content in the `工作空间` tab
- **THEN** uploaded user materials MUST appear under the user-facing group label `upload`
- **AND** runtime-written or manually created workspace files and folders MUST appear under the user-facing group label `project`

#### Scenario: Workspace group headers use folder iconography
- **WHEN** the workbench renders the `upload` or `project` group header
- **THEN** the header MUST show a folder icon before the group label

#### Scenario: Empty workspace groups stay visually clean
- **WHEN** the workbench renders an empty `upload` or `project` group
- **THEN** the group header MUST remain visible
- **AND** the sidebar MUST NOT render a `0` count for that empty group
- **AND** the sidebar MUST NOT render a separate `暂无文件` row for that empty group

#### Scenario: Long workspace file lists remain scrollable inside the sidebar
- **WHEN** the `工作空间` tab contains enough `upload` and `project` entries to exceed the available sidebar height
- **THEN** the sidebar MUST keep later file entries reachable through normal vertical scrolling inside the sidebar pane
- **AND** the user MUST be able to browse the rest of the file tree without relying on page-level scrolling
- **AND** nested file-tree containers MUST NOT suppress or fragment that vertical scrolling behavior

#### Scenario: User opens a workspace file from the tree
- **WHEN** the user opens a workspace file from the right-side workspace sidebar tree
- **THEN** the frontend MUST enter a workspace-expanded state
- **AND** the layout MUST insert a central workspace area between the conversation surface and the workspace sidebar
- **AND** the workspace-expanded state MUST keep the conversation surface visible

#### Scenario: Workspace-open shell renders supported file content
- **WHEN** the user opens a supported workspace file in the expanded shell
- **THEN** the central workspace area MUST render the current file content instead of placeholder-only copy
- **AND** the shell MUST provide the file-specific review surface needed for supported plain-text files, Markdown files, CSV files, and `txt` files that are configured for MML parsing

#### Scenario: Upload file opens as an editable workspace surface
- **WHEN** the user opens a workspace file sourced from the scoped `upload` tree
- **THEN** the workbench MUST render that file content in the normal workspace shell
- **AND** the shell MUST allow editing and saving that file in place instead of presenting it as read-only

#### Scenario: User saves the current editable file in place
- **WHEN** the user edits an editable workspace file in either `upload` or `project`
- **THEN** the frontend MUST persist those changes as the new current content of that same file
- **AND** the save flow MUST NOT require the user to create or choose an explicit versioned copy

#### Scenario: User manually collapses the sidebar in workspace-expanded state
- **WHEN** the user activates the explicit sidebar collapse control while a workspace file is open
- **THEN** the workbench MUST hide the sidebar from the active shell layout rather than only toggling internal state
- **AND** the workbench MUST keep the current workspace file open and active
- **AND** the workbench MUST expose an explicit affordance to re-expand the sidebar without leaving the current file

#### Scenario: User re-expands the sidebar after manual collapse
- **WHEN** the user activates the explicit sidebar re-expand control from a manually collapsed state
- **THEN** the workbench MUST restore the sidebar in the same workspace-expanded shell
- **AND** the workbench MUST keep the previously active workspace file open
- **AND** the workbench MUST preserve sidebar-local context such as expanded folders unless the user performed a separate reset action

#### Scenario: Constrained width auto-collapses sidebar by default
- **WHEN** the workbench body width becomes too narrow to satisfy the workspace-expanded minimum layout
- **THEN** the workbench MUST auto-collapse the sidebar by default
- **AND** the workbench MUST still expose an explicit re-expand affordance
- **AND** the auto-collapsed state MUST NOT close or blur the active workspace file

#### Scenario: User can temporarily reopen the sidebar while constrained width remains active
- **WHEN** constrained-width auto-collapse is active and the user explicitly re-expands the sidebar
- **THEN** the workbench MUST render the sidebar again without clearing the active workspace file
- **AND** the sidebar header MUST keep `工作空间` / `模板` and the collapse control usable within the constrained width
- **AND** a later user-initiated collapse MUST take effect immediately even if constrained-width auto-collapse is still active

### Requirement: Workbench SHALL present governed starter skills with two-step selection
The workbench SHALL continue to project governed starter guidance for the active agent within the empty conversation shell, using a two-step selection model where the user first expands a skill's starter summary and then confirms execution, while allowing the user to inspect the starter summary through a desktop-only hover help surface.

#### Scenario: Empty conversation shell shows governed starter groups with preview skills
- **WHEN** an authenticated user views the workbench with no persisted session selected or with an empty draft conversation
- **THEN** the conversation surface MUST show governed starter entries grouped by the supported task-group model for the active agent
- **AND** each non-empty starter group MUST show a preview list of up to 3 governed user-facing skill names

#### Scenario: Clicking a skill name expands its starter summary within the card
- **WHEN** a user clicks a skill name inside a starter card
- **THEN** the workbench MUST expand that skill's starter summary inline within the card

#### Scenario: Hovering the `i` trigger shows the starter summary on desktop
- **WHEN** a user hovers the `i` trigger in a starter card on a desktop viewport
- **AND** the help card MUST display the governed user-facing skill name and the governed starter summary for that skill

#### Scenario: Starter card hover help placement follows column position
- **WHEN** the workbench shows a starter-skill hover help card in the desktop starter grid
- **THEN** the help card MUST use the fixed placement rule for the current three-column starter layout
- **AND** the first starter column MUST place the card to the right of the trigger
- **AND** the second starter column MUST place the card below the trigger
- **AND** the third starter column MUST place the card to the left of the trigger

#### Scenario: Long starter summary truncates with read-more affordance
- **WHEN** the starter summary is long enough to exceed the hover help card's intended reading density

#### Scenario: Global single-selection across all starter cards and search
- **WHEN** a skill is expanded in any starter card or in the search results
- **THEN** no other skill in any starter card or in the search results MUST remain expanded at the same time

#### Scenario: Confirming a skill sends its starter prompt
- **THEN** the workbench MUST emit the skill's `starterPrompt` for execution
- **AND** the workbench MUST clear the selected skill state after sending

#### Scenario: Empty starter group shows no content
- **WHEN** a governed starter group has no managed skills for the current agent surface
- **THEN** the starter card in ConversationPane MUST render nothing in place of the skill list
- **AND** the card MUST NOT render any empty-state text or message
- **AND** the card MUST NOT respond to skill click interactions

#### Scenario: Starter cards do not interact with the search area
- **WHEN** a user clicks a skill name, opens a hover help card, or expands a skill in a starter card
- **THEN** the workbench MUST NOT modify the search input value
- **AND** the workbench MUST NOT modify the search results
- **AND** the workbench MUST NOT change the expanded/collapsed state of the search area

### Requirement: Workbench SHALL provide an independent expanded search area
The "更多搜索" area SHALL operate independently from the starter cards, default to expanded, and provide global skill search without any starter-group filtering.

#### Scenario: Search area is expanded by default
- **WHEN** an authenticated user views the workbench empty conversation shell
- **THEN** the "更多搜索" area MUST be in its expanded state by default
- **AND** the search input MUST be empty

#### Scenario: Search area shows hot skills when no query is entered
- **WHEN** the search input is empty
- **THEN** the search area MUST display hot skill chips
- **AND** the search area MUST NOT display the full skill list

#### Scenario: Clicking a hot skill chip fills the search input
- **WHEN** a user clicks a hot skill chip
- **THEN** the workbench MUST set the skill name as the search input value
- **AND** the search results MUST be filtered by that value

#### Scenario: Search filters skills globally without group scoping
- **WHEN** a user types a search query or a hot skill chip fills the search input
- **THEN** the workbench MUST filter all visible skills by the search query
- **AND** the workbench MUST NOT limit results to any specific intent group
- **AND** the search results MUST be ordered by starter priority

#### Scenario: Search results support the same two-step selection as starter cards
- **WHEN** a user clicks a skill name in the search results
- **THEN** the workbench MUST expand that skill's description inline
- **AND** the workbench MUST show a "开始使用" text link below the description
- **AND** the workbench MUST collapse any expanded skill in the starter cards (global single-selection)

#### Scenario: Empty search results show suggestions for available intent groups only
- **WHEN** a search query produces no matching skills
- **THEN** the search area MUST display an empty-state message
- **AND** the search area MUST display suggestion chips only for intent groups that currently have at least one visible skill

#### Scenario: Empty search results hide suggestion chips when no intent group has skills
- **WHEN** a search query produces no matching skills
- **AND** none of the supported intent groups currently has any visible skill
- **THEN** the search area MUST display only the empty-state message
- **AND** the search area MUST NOT render the suggestion-chip container

#### Scenario: Clicking an empty-state suggestion chip applies the corresponding category query
- **WHEN** a user clicks the `方案制作` empty-state suggestion chip
- **THEN** the workbench MUST set the search input value to `方案 制作`
- **AND** the resulting search results MUST show all visible skills in the `planning` intent group

#### Scenario: Clearing the search input returns to hot skills
- **WHEN** a user clears the search input (via the clear button or by deleting all text)
- **THEN** the search area MUST return to displaying hot skill chips
- **AND** the search results list MUST be hidden

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

### Requirement: Workbench SHALL provide Markdown preview in the workspace editor
The workbench SHALL provide a dedicated Markdown preview path for workspace files identified as Markdown and SHALL default those files into preview whenever they become the current active workspace file, so users can review rendered document structure without leaving the workspace shell. The Markdown preview renderer SHALL use marked for GFM-compatible parsing and DOMPurify for output sanitization, and SHALL support GFM tables and strikethrough in addition to the previously supported inline and block structures.

#### Scenario: Markdown file defaults to preview when activated
- **WHEN** the user opens or re-activates a Markdown workspace file in the expanded shell
- **THEN** the editor MUST show the preview view by default for that file
- **AND** the editor MUST still provide an edit view for that same file inside the standard workspace shell

#### Scenario: Markdown file can switch between edit and preview views
- **WHEN** the user switches a Markdown workspace file into edit view and later returns it to preview view
- **THEN** the editor MUST provide both an edit view and a preview view for that file
- **AND** switching to preview MUST render the current workspace file content rather than a stale saved snapshot

#### Scenario: Markdown re-activation does not depend on remembered per-file view state
- **WHEN** the user manually switches a Markdown workspace file into edit view, activates another file, and later re-activates the original Markdown file
- **THEN** the editor MUST return that Markdown file to preview by default
- **AND** the workbench MUST NOT require per-file remembered view state to restore the Markdown default

#### Scenario: Markdown preview remains inside the standard workspace shell
- **WHEN** the user views a Markdown workspace file in preview view
- **THEN** the workbench MUST keep the surrounding workspace shell, tabs, save controls, and conversation surface visible
- **AND** the workbench MUST NOT navigate the user into a separate document page or standalone viewer

#### Scenario: Markdown preview renders GFM tables
- **WHEN** the preview content contains a GFM table with pipe-delimited rows and a separator row
- **THEN** the preview MUST render that table as an HTML table with visible header cells and body rows
- **AND** the table MUST NOT appear as raw pipe-delimited text

#### Scenario: Markdown preview renders GFM strikethrough
- **WHEN** the preview content contains text wrapped in double tildes such as `~~deleted~~`
- **THEN** the preview MUST render that text with a strikethrough presentation

#### Scenario: Markdown preview preserves raw-HTML-as-literal-text behavior
- **WHEN** the preview content contains raw HTML tags such as `<script>alert(1)</script>`
- **THEN** the preview MUST display those tags as escaped literal text
- **AND** the preview MUST NOT render those tags as effective HTML elements

#### Scenario: Markdown preview filters non-whitelisted link protocols
- **WHEN** the preview content contains a link whose href uses a protocol outside `http`, `https`, `mailto`, `#` anchor, or `/` relative path
- **THEN** the preview MUST NOT render that link as a clickable `<a>` element
- **AND** the preview MUST display only the link text as plain text

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

### Requirement: Workspace editor SHALL keep primary controls width-stable in the expanded shell
The workspace editor SHALL preserve a width-stable primary toolbar in the workspace-expanded shell so that the active document remains the highest-priority surface.

#### Scenario: Primary toolbar stays single-line during normal desktop workspace editing
- **WHEN** the workbench is in the workspace-expanded shell at normal desktop workspace widths
- **THEN** the editor MUST keep view switching, the MML parsing summary entry, save state, and save action on a single primary row
- **AND** the editor MUST NOT rely on toolbar wrapping or horizontal scrolling for those primary controls
- **AND** the primary row MUST NOT reserve space for a low-value shell-dismiss action such as `关闭工作区`

#### Scenario: Low-frequency editor controls do not compete with the primary row
- **WHEN** the editor needs to expose lower-frequency MML configuration details
- **THEN** those details MUST appear in a secondary disclosure area rather than as always-visible primary-toolbar form controls
- **AND** passive status text such as file-loaded state MUST NOT permanently occupy primary-toolbar space

#### Scenario: Closing the last open file exits the expanded shell
- **WHEN** the user closes the final open workspace file in the expanded shell
- **THEN** the workbench MUST exit the workspace-expanded state without requiring a separate dedicated `关闭工作区` action
- **AND** the conversation-first shell MUST remain visible as the base state

### Requirement: Workbench conversation messages SHALL preserve structured message types
The authenticated workbench SHALL preserve structured assistant message types from the backend so that conversation rendering and interaction do not depend on flattening all assistant output into plain text or reparsing raw assistant JSON text.

#### Scenario: Persisted protocol message remains structured after session load
- **WHEN** the frontend loads session history and a persisted assistant message is returned with `kind: "protocol"`
- **THEN** the workbench MUST preserve that message as a protocol-capable message in frontend state
- **AND** the frontend MUST NOT discard its protocol payload or protocol state during session-message mapping

#### Scenario: Persisted domain-result message remains structured after session load
- **WHEN** the frontend loads session history and a persisted assistant message is returned with `kind: "result"` for a structured domain result
- **THEN** the workbench MUST preserve that message as a rich result message in frontend state
- **AND** the frontend MUST NOT fall back to presenting the raw JSON text body as the primary visible message

#### Scenario: Terminal structured result remains distinguishable from plain text
- **WHEN** a completed run returns a structured result payload such as a row-preview result, artifact reference, or structured runtime failure context
- **THEN** the workbench MUST preserve enough structure to render a richer message surface
- **AND** the frontend MUST NOT rely solely on the plain `text` field to decide how to present that result

### Requirement: Workbench SHALL render planner protocol messages inside the conversation stream
The workbench SHALL render protocol messages directly in the conversation stream and SHALL support the broader workbench protocol component surface required by migrated runtime flows, including `text`, `list`, `form`, `table`, and `button-group` components.

#### Scenario: Protocol message renders form and button-group components in the stream
- **WHEN** the conversation contains a protocol message with `text`, `form`, and `button-group` components
- **THEN** the conversation surface MUST render those components within the standard message stream
- **AND** the user MUST be able to interact with rendered fields and buttons without leaving the workbench conversation shell

#### Scenario: Protocol message renders editable or read-only table components safely
- **WHEN** the conversation contains a protocol message with a `table` component
- **THEN** the conversation surface MUST render the table structure in the message body
- **AND** editable tables MUST preserve user edits as protocol runtime state rather than collapsing back to plain text

#### Scenario: Unsupported protocol subtype falls back safely
- **WHEN** the workbench receives a protocol message that contains unsupported component kinds
- **THEN** the conversation surface MUST degrade safely without breaking the message list
- **AND** the unsupported payload MUST NOT prevent supported protocol components in the same message from rendering

### Requirement: Workbench SHALL complete the plan approval and revision loop from protocol actions
The workbench SHALL allow users to approve or revise the current planner output directly from the protocol message that owns the plan decision actions.

#### Scenario: User approves a plan with no unresolved planning questions
- **WHEN** the active conversation contains a plan protocol message whose action requests `decision: "approve"`
- **AND** the backend accepts that decision
- **THEN** the frontend MUST invoke the runtime plan-decision flow for the active session
- **AND** the workbench MUST refresh visible session plan state after the decision succeeds
- **AND** the conversation surface MUST reflect that the plan has been approved for execution

#### Scenario: User keeps the plan in revise mode
- **WHEN** the active conversation contains a plan protocol message whose action requests `decision: "revise"`
- **AND** the backend accepts that decision
- **THEN** the workbench MUST keep the session in planner mode
- **AND** the conversation surface MUST reflect that the user chose to continue revising the plan

#### Scenario: Approval blocked by unresolved planning questions
- **WHEN** the user attempts to approve a plan that still has unresolved planning questions
- **THEN** the workbench MUST show explicit feedback that approval is blocked
- **AND** the frontend MUST NOT pretend the plan was approved locally

### Requirement: Workbench SHALL persist interactive protocol UI state
The workbench SHALL persist protocol UI state changes for interactive messages through the backend session-message protocol-state contract and SHALL recover richer protocol snapshots such as form state, selection state, table state, and converged message overrides after reload.

#### Scenario: Protocol state survives reload of the same session
- **WHEN** a user interacts with a protocol message in a way that changes its tracked UI state
- **THEN** the frontend MUST persist that updated protocol state to the backend for the owning session message
- **AND** reloading the same session later MUST allow the workbench to recover that protocol state for rendering

#### Scenario: Reload uses persisted message override after an interactive protocol action
- **WHEN** an earlier protocol action persists a converged message snapshot in protocol state
- **THEN** the workbench MUST render that persisted message snapshot when the session is reloaded
- **AND** the frontend MUST NOT revive stale interactive controls from the original protocol payload for that message

### Requirement: Workbench SHALL present a first batch of rich conversation results
The workbench SHALL present the first batch of rich result surfaces for structured runtime outputs and structured runtime failures without introducing a separate assistant cockpit or leaking raw structured JSON as a normal assistant bubble.

#### Scenario: Structured row result renders as a conversation result card
- **WHEN** a completed run returns a structured row-preview result
- **THEN** the conversation surface MUST render a table-like preview card in the message stream
- **AND** the user MUST still be able to read the surrounding conversation normally

#### Scenario: Artifact reference renders as a conversation artifact card
- **WHEN** a completed run or reloaded session returns an artifact reference result
- **THEN** the conversation surface MUST render a dedicated artifact-oriented message card rather than leaving the payload as raw JSON text
- **AND** artifact actions for supported workspace files MUST continue to use the existing `打开文件` entry point regardless of whether the referenced file is Markdown

#### Scenario: Structured runtime failure renders as an error card
- **WHEN** a run fails and returns structured runtime failure metadata
- **THEN** the workbench MUST render an explicit failure-oriented message or card
- **AND** the user-facing error presentation MUST be more specific than a generic status string alone

### Requirement: Workbench SHALL execute protocol actions through a general protocol runtime
The workbench SHALL execute protocol actions through a reusable protocol runtime that can assemble runtime state, resolve placeholders, and dispatch supported action types including `submit`, `cancel`, `tool`, `redirect`, and `delegate`.

#### Scenario: Submit action resolves runtime placeholders from form state
- **WHEN** a protocol action contains placeholder-based tool input that references current protocol form state
- **THEN** the workbench MUST resolve those placeholders against the current message runtime state before dispatch
- **AND** the dispatched action payload MUST reflect the user-entered values rather than unresolved placeholder strings

#### Scenario: Redirect action changes the visible protocol message state
- **WHEN** a protocol action requests a redirect to another component or view state within the same protocol message
- **THEN** the workbench MUST update the visible protocol message accordingly
- **AND** the redirected state MUST be eligible for persistence and reload recovery

### Requirement: Workbench SHALL provide explicit compatibility handling for workbook-coupled protocol tool actions
The workbench SHALL provide explicit compatibility behavior for workbook-coupled protocol tool actions such as gateway invocation and row-modification flows.

#### Scenario: Workbook-backed tool action executes when the required runtime context is available
- **WHEN** a protocol tool action requires workbook or gateway runtime context
- **AND** the current workbench state has the required compatible context
- **THEN** the workbench MUST execute that action through the governed runtime path
- **AND** the resulting protocol or status changes MUST be reflected in the conversation stream

#### Scenario: Workbook-backed tool action fails with governed compatibility feedback when context is missing
- **WHEN** a workbook-coupled protocol tool action is triggered without the required compatible workbench context
- **THEN** the workbench MUST show explicit governed feedback explaining that the current context cannot execute the action
- **AND** the frontend MUST NOT fall back to a generic unsupported-action error for that case

### Requirement: Workbench SHALL allow artifact result cards to open referenced workspace files
The workbench SHALL allow structured artifact results in the conversation stream to act as direct entry points into the workspace editor for the referenced file.

#### Scenario: Artifact result opens the referenced file in the workspace shell
- **WHEN** the active conversation contains an artifact reference result that points to a workspace file
- **THEN** the result card MUST offer a direct open-file action
- **AND** invoking that action MUST open the referenced file in the workspace-expanded shell and make it the active workspace file
- **AND** supported Markdown artifact references MUST continue to use the same `打开文件` action label as other supported workspace files

#### Scenario: Missing artifact reference fails safely
- **WHEN** the user invokes the open-file action for an artifact reference whose workspace file can no longer be resolved
- **THEN** the workbench MUST show explicit feedback that the file is unavailable
- **AND** the conversation stream MUST remain usable

### Requirement: Workbench SHALL use the active workspace file as the primary follow-up file context
The workbench SHALL distinguish the active workspace file from the broader workspace file set and SHALL use that active file's workspace-relative path as the primary file context for follow-up Agent actions initiated from the workspace flow while relying on runtime file-discovery tools rather than auto-injecting the broader workspace file set by default.

#### Scenario: Opening or switching tabs changes the active workspace file
- **WHEN** the user opens a workspace file or switches to another open file tab
- **THEN** the workbench MUST update the active workspace file to match the visible current file
- **AND** follow-up workspace actions MUST target that active file

#### Scenario: Continue-processing action prefers the active workspace file path
- **WHEN** the user triggers the workspace action to continue Agent processing for the current file
- **THEN** the frontend MUST submit that active workspace file's workspace-relative path as the primary file context for that follow-up action
- **AND** the follow-up request MUST NOT require opaque `fileKey` syntax as the model-facing file contract

#### Scenario: Newly written workspace output remains discoverable but is not auto-submitted
- **WHEN** a successful run adds or overwrites a workspace output file and the user later starts another run for the same active agent
- **THEN** the workbench MUST keep that file available in the workspace sidebar for explicit opening or later discovery
- **AND** the frontend MUST NOT auto-submit that broader workspace file set as supplementary file context unless the user explicitly selects a file for that run

### Requirement: Workbench SHALL recognize MML header metadata in supported text files
The workbench SHALL treat text files with a standard leading MML header comment as MML files and SHALL project that header into structured workspace toolbar controls.

#### Scenario: Standard MML header enables toolbar metadata controls
- **WHEN** a supported text file opens with a leading header comment of the form `/* ME TYPE=<type>, Version=<version> */`
- **THEN** the workbench MUST identify that file as MML in the workspace shell
- **AND** the toolbar MUST show `网元类型` and `网元版本` fields populated from the parsed header values

#### Scenario: Saving MML metadata writes the toolbar values back to the header
- **WHEN** the user changes `网元类型` or `网元版本` for an opened MML file and then saves the file
- **THEN** the workbench MUST persist those values back into the file's leading MML header comment
- **AND** the saved file content MUST remain the authority for future MML toolbar rendering

### Requirement: Workbench SHALL use Monaco as the text editing engine for text-class workspace files
The workbench SHALL use Monaco as the editing engine for supported text-class workspace files while preserving CSV as a separate table-oriented editing path.

#### Scenario: Plain text file opens in a Monaco-backed text view
- **WHEN** the user opens a supported plain text workspace file in the expanded workspace shell
- **THEN** the text view MUST render through a Monaco-backed editor surface
- **AND** the workbench MUST keep the surrounding workspace shell actions for tabs, save, and continue processing outside the editor engine

#### Scenario: Markdown file opens in a Monaco-backed text view
- **WHEN** the user opens a supported Markdown workspace file in edit view
- **THEN** the workbench MUST render that file through the same Monaco-backed editor path used for other text-class files
- **AND** the workbench MUST keep the surrounding workspace shell actions for tabs, save, preview switching, and continue processing outside the editor engine
- **AND** the Markdown file's save state and save action MUST remain on the same primary toolbar row used by the current text-file workspace experience

#### Scenario: Markdown text view binds to a Markdown Monaco language id
- **WHEN** the user opens a supported Markdown workspace file in edit view
- **THEN** the text editor MUST bind that file to a Markdown Monaco language id rather than treating it as `plaintext`

#### Scenario: MML file text view opens in the same Monaco-backed editor path
- **WHEN** the user opens an MML-capable workspace file in text view
- **THEN** the workbench MUST render the file's raw text through the same Monaco-backed text editor path used for plain text files
- **AND** the workbench MUST NOT require a separate MML-only editor engine for this change

#### Scenario: MML text view binds to a dedicated Monaco language
- **WHEN** the user opens an MML-capable workspace file in text view
- **THEN** the text editor MUST bind that file to a dedicated MML Monaco language id
- **AND** the workbench MUST NOT continue to treat that file as `plaintext` for syntax tokenization

#### Scenario: CSV remains on the table-oriented editing path
- **WHEN** the user opens a CSV workspace file
- **THEN** the workbench MUST continue to use the table-oriented CSV view rather than routing that file through Monaco as the primary editing surface

### Requirement: Workbench SHALL provide domain-oriented MML syntax highlighting in text view
The workbench SHALL provide domain-oriented lexical highlighting for MML text view so command-heavy files are easier to inspect and correct.

#### Scenario: MML commands receive structural tokenization
- **WHEN** an MML text view contains a Huawei-style statement such as `ADD PNFPROFILE:NFINSTANCEID="PCF_Instance_0", NFTYPE=NfPCF;`
- **THEN** the editor MUST treat the full command head before `:` as one command-name highlighting region
- **AND** the editor MUST distinguish parameter identifiers, parameter values, structural delimiters, and statement terminators

#### Scenario: Command names remain visually unified
- **WHEN** an MML text view contains a statement such as `ADD RULE:RULENAME="A";`
- **THEN** the editor MUST highlight `ADD RULE` as one command name
- **AND** the editor MUST NOT require the user to visually interpret that command head only as separate verb and object tokens

#### Scenario: MML values preserve Huawei-style value forms
- **WHEN** an MML command body contains values such as quoted strings, numbers, bareword enum values, symbolic bareword values, or prefixed literals
- **THEN** the editor MUST preserve those values as command-body value tokens rather than collapsing them into generic identifier-only tokenization
- **AND** values such as `GMT+0800`, `NONBICC/NONSIP`, and `K'135` MUST remain readable as single value forms in the text view

#### Scenario: Parameter names receive dedicated highlighting
- **WHEN** an MML command body contains parameters such as `RULENAME="A", PRIORITY=10`
- **THEN** the editor MUST highlight `RULENAME` and `PRIORITY` as parameter names
- **AND** parameter values MAY remain visually weaker than the command name and parameter names as long as they remain readable

#### Scenario: Supported MML comment forms render as comments
- **WHEN** an MML text view contains `/* ... */`, `// ...`, or supported `# ...` comment forms
- **THEN** the editor MUST render those ranges as comment content
- **AND** comment markers that appear inside quoted string values MUST NOT start comment tokenization

#### Scenario: MML supports empty command bodies
- **WHEN** an MML text view contains a statement such as `LST NFROUTEPLCY:;`
- **THEN** the editor MUST treat that statement as structurally valid MML text for tokenization
- **AND** the editor MUST NOT require at least one `PARAM=VALUE` pair after `:`

#### Scenario: MML tokenization restarts after a statement terminator
- **WHEN** an MML text view contains multiple statements in one line separated by `;`
- **THEN** the editor MUST allow tokenization to restart immediately after the statement terminator
- **AND** the following command verb MUST NOT be forced into the previous statement's body tokenization state

#### Scenario: Unknown identifiers preserve structural highlighting
- **WHEN** an MML text view contains an unrecognized command object or parameter key
- **THEN** the editor MUST continue to provide stable structural tokenization for the statement
- **AND** the workbench MUST NOT require a fully enumerated MML command catalog for this change

### Requirement: Workbench SHALL keep MML toolbar metadata controls outside the text editor engine
The workbench SHALL treat MML toolbar metadata controls as shell-owned structured projections of the leading header comment rather than as Monaco-owned business state.

#### Scenario: MML toolbar renders outside the text editor engine
- **WHEN** the active workspace file is recognized as MML
- **THEN** the workbench MUST render `网元类型` and `网元版本` as workspace toolbar controls outside the text editor engine
- **AND** those controls MUST remain available without requiring Monaco-specific UI widgets or inline editor decorations

#### Scenario: Editing toolbar metadata does not require immediate text rewriting
- **WHEN** the user changes `网元类型` or `网元版本` from the workspace toolbar
- **THEN** the workbench MUST mark the file as dirty and preserve those metadata edits for save
- **AND** the workbench MUST NOT require the raw text view to be rewritten immediately during that toolbar interaction

#### Scenario: Editing the leading MML header refreshes toolbar metadata
- **WHEN** the user edits the leading MML header directly in the text editor
- **THEN** the workbench MUST be able to refresh the visible `网元类型` and `网元版本` toolbar values from the edited text
- **AND** the saved file content MUST remain the authority for later toolbar rendering

#### Scenario: Non-standard comments do not drive MML toolbar metadata
- **WHEN** an MML file contains non-leading block comments or supported `//` or `#` comments
- **THEN** the workbench MUST NOT treat those comments as input for `网元类型` or `网元版本`
- **AND** only the standard leading MML header comment MAY drive toolbar metadata parsing for this change

### Requirement: Workbench SHALL preserve store-centered file authority across Monaco-backed text editing
The workbench SHALL keep workspace file content, metadata, dirty state, and follow-up execution context authoritative in workbench state rather than in Monaco editor instance state.

#### Scenario: Save uses workbench file state rather than reading business state from Monaco directly
- **WHEN** the user saves an opened text-class workspace file
- **THEN** the workbench MUST use the current workspace file state for the save operation
- **AND** the system MUST NOT require save behavior to depend on Monaco editor instance state as the business source of truth

#### Scenario: Continue-processing uses the current workspace file state after Monaco editing
- **WHEN** the user triggers continue processing for an active text-class workspace file after editing in Monaco
- **THEN** the workbench MUST use the current workspace file state as the source for any required save-before-run behavior
- **AND** the active file sent into the follow-up Agent flow MUST reflect the latest saved workspace file state rather than editor-local transient state

### Requirement: Workbench SHALL converge short-circuit structured runs from terminal structured state
The workbench SHALL treat terminal structured run results as authoritative for short-circuit protocol and domain-result runs, even when those runs do not stream a raw assistant text body.

#### Scenario: Protocol short-circuit run completes without raw assistant text stream
- **WHEN** an active run completes with a protocol short-circuit result
- **THEN** the workbench MUST be able to converge the in-flight assistant placeholder into a protocol-capable message from the terminal structured result
- **AND** the frontend MUST NOT require a raw JSON `assistant.delta` or `assistant.final` text payload to render that message correctly

#### Scenario: Domain-result short-circuit run completes without raw assistant text stream
- **WHEN** an active run completes with a structured domain result short-circuit output such as an artifact reference
- **THEN** the workbench MUST be able to converge the in-flight assistant placeholder into the corresponding rich result message from the terminal structured result
- **AND** the frontend MUST NOT require a raw JSON `assistant.delta` or `assistant.final` text payload to render that result correctly

### Requirement: Workbench SHALL render MML table view as a workbook shell with a fixed summary sheet
The workbench SHALL render the MML table view as a workbook shell where `汇总` is a dedicated summary sheet that is always shown as the leftmost tab and where command-sheet grids appear only when a non-summary tab is active.

#### Scenario: Summary sheet is always the leftmost workbook tab
- **WHEN** the user opens an MML-capable workspace file in table view
- **THEN** the workbook tab row MUST render a `汇总` tab at the far left
- **AND** command-sheet tabs discovered from parsed command heads MUST render to the right of that fixed summary tab

#### Scenario: Summary tab owns summary content instead of a top-of-grid banner
- **WHEN** the active workbook tab is `汇总`
- **THEN** the workbench MUST render the MML summary content inside the sheet body for that tab
- **AND** the command-sheet grid MUST NOT render at the same time as a separate banner-above-grid summary surface

#### Scenario: Command-sheet tab focuses the workbook body on the active sheet grid
- **WHEN** the user activates a command-sheet tab such as `ADD RULE`
- **THEN** the workbench MUST render only the active command-sheet grid in the workbook body
- **AND** any sheet-level status summary MUST move to the bottom status bar rather than remain as extra page chrome above the grid

### Requirement: Workbench SHALL present the MML workbook shell with Excel-like worksheet visual hierarchy
The workbench SHALL present MML table view with an Excel-like worksheet shell so users perceive the area as one workbook surface rather than as generic application tabs above an embedded grid.

#### Scenario: Sheet tabs read as worksheet tabs instead of pill-style navigation
- **WHEN** the user opens an MML-capable workspace file in table view
- **THEN** the workbook tab row MUST present `汇总` and command-sheet entries as worksheet-style tabs that visually belong to the workbook shell
- **AND** inactive tabs MUST use a low-emphasis state rather than reading as high-prominence pill buttons or primary navigation actions

#### Scenario: Active sheet surface is visually connected to the tab strip
- **WHEN** the user views either the `汇总` sheet or an active command sheet in MML table view
- **THEN** the tab strip and active sheet body MUST read as one connected workbook surface through aligned borders, spacing, and container treatment
- **AND** the shell MUST NOT present the active grid area as an unrelated floating card beneath a separate tab control

#### Scenario: Summary and command sheets stay within the same workbook language
- **WHEN** the user switches between `汇总` and any command-sheet tab in MML table view
- **THEN** both views MUST preserve the same workbook-shell visual language at the outer container level
- **AND** the summary view MUST NOT feel like leaving the workbook for a separate dashboard-style page chrome treatment

### Requirement: Workbench SHALL use a spreadsheet-style grid for active MML command sheets
The workbench SHALL render each active MML command sheet through a spreadsheet-style grid engine that supports bounded Excel-like interactions within the product's current dependency constraints.

#### Scenario: Active command sheet supports rectangular selection and standard clipboard actions
- **WHEN** the user interacts with an active MML command sheet in table view
- **THEN** the grid MUST support one rectangular active selection with keyboard navigation
- **AND** the workbench MUST support standard copy and paste behavior for editable target ranges on that active sheet

#### Scenario: Schema-driven enum parameters use spreadsheet dropdown editors
- **WHEN** an active MML command sheet includes a known parameter whose schema control type is `select`
- **THEN** the grid MUST present that cell through a dropdown-style spreadsheet editor
- **AND** known non-enum parameters MAY use text-style spreadsheet editors as long as they still obey the schema-driven editability rules

#### Scenario: Workbook status bar reflects active sheet and selection feedback
- **WHEN** the user focuses or changes selection inside an active MML command sheet
- **THEN** the bottom workbook status bar MUST reflect the active sheet and the current cell or rectangular selection
- **AND** blocked-edit or read-only fallback feedback MUST be surfaced in that status bar without requiring a persistent banner above the grid

### Requirement: Workbench SHALL preserve conservative MML editability and text-first round-tripping during spreadsheet interactions
The workbench SHALL continue to treat MML text as the only document authority even when the active command sheet is rendered through a spreadsheet grid.

#### Scenario: Read-only rows remain blocked in spreadsheet editing flows
- **WHEN** a user attempts to edit or paste into a cell that belongs to a read-only MML row or an otherwise non-editable target
- **THEN** the workbench MUST block that spreadsheet edit
- **AND** for that blocked in-grid action in table view, the workbench MUST keep table view active and surface the reason in table-context feedback instead of automatically switching to text view

#### Scenario: Safe spreadsheet edits rewrite only the targeted MML statement text
- **WHEN** the user applies a valid spreadsheet edit to a safe editable MML cell
- **THEN** the workbench MUST route that change back through the MML projection and statement-level rewrite path
- **AND** the saved file content MUST continue to preserve untouched comments, blank lines, statement order, and other non-edited text segments

#### Scenario: Batch paste degrades conservatively when the target rectangle is not fully safe
- **WHEN** the user pastes a rectangular value range into an active MML command sheet
- **AND** any targeted cell would require editing a read-only row, an unknown-parameter area, or another unsupported target
- **THEN** the workbench MUST reject that spreadsheet paste operation rather than silently applying only part of it
- **AND** the underlying MML text content MUST remain unchanged by that blocked paste

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

### Requirement: Workbench SHALL use one backend MML rule schema across text and table editing
The workbench SHALL treat the canonical web-backend MML schema lookup as the shared semantic source for both Monaco-backed MML text editing and workbook-style MML table projection.

#### Scenario: Text and table modes resolve the same network-version rule set
- **WHEN** the user opens an MML-capable workspace file whose toolbar metadata identifies a `networkType` and `networkVersion`
- **THEN** the workbench MUST load one backend MML schema for that `networkType + networkVersion`
- **AND** it MUST fetch that schema from the canonical `/web/api/mml/schema` route rather than through `agent-backend`'s `/agent/api/files/mml-schema` compatibility path
- **AND** both the Monaco text path and the MML workbook table path MUST consume that same loaded schema rather than maintaining separate rule catalogs

#### Scenario: Table mode continues to project workbook sheets from the shared schema
- **WHEN** the user enters MML table view for a file whose backend rule schema is available
- **THEN** the workbench MUST continue to build workbook sheets, columns, and editability rules from the loaded schema
- **AND** replacing the schema transport path with the canonical web route MUST NOT remove the current workbook-style summary sheet and command-sheet interaction model

#### Scenario: Typed workbook columns use schema-aware editors and bounded values
- **WHEN** an active MML command sheet includes a known parameter whose loaded schema identifies enum values, integer constraints, or composite flag-set options
- **THEN** the table view MUST use a schema-aware cell editing behavior for that column
- **AND** enum-style columns MUST present a dropdown-style editor and reject values outside the declared enum set
- **AND** integer-style columns MUST reject values that violate the schema rules the current workbook path understands for that type
- **AND** composite-flag-set-style columns MUST use a template-guided editing path that helps the user compose a valid serialized value from the declared option set rather than requiring fully manual free-text authoring

#### Scenario: Composite flag-set workbook editor serializes stable MML text from structured choices
- **WHEN** the user edits a composite-flag-set-style parameter in an active MML command sheet
- **THEN** the workbench MUST present each declared option as a structured enabled or disabled choice within the table-editing flow
- **AND** confirming that edit MUST serialize only the enabled options back into canonical MML text using the declared option order
- **AND** the underlying workbook rewrite path MUST continue to persist the serialized composite value text back through the text-first document authority model

#### Scenario: Missing schema blocks both advanced text assistance and table projection consistently
- **WHEN** the workbench cannot load backend MML schema for the current `networkType + networkVersion`
- **THEN** the workbench MUST keep MML text editing available as plain text entry
- **AND** it MUST withhold schema-driven table projection and schema-driven editor assistance until that rule schema becomes available

### Requirement: Workbench SHALL 仅按最小长度和最大长度校验字符串参数
The workbench SHALL treat backend MML schema as the shared semantic source for text and table editing, and for string parameters it MUST validate values only against `minLength` and `maxLength` rather than using `exactLength`.

#### Scenario: Text diagnostics ignore historical exact string length
- **WHEN** the user edits an MML string parameter in text view and the loaded schema for that parameter contains `minLength`、`maxLength`, and a historical `exactLength`
- **THEN** the workbench MUST continue to enforce the configured minimum and maximum string length bounds
- **AND** it MUST NOT emit a string-length diagnostic solely because the current value does not equal that historical `exactLength`

#### Scenario: Workbook cell validation follows the same string length rule
- **WHEN** the user edits a known string parameter cell in MML table view and the loaded schema for that parameter contains `minLength`、`maxLength`, and a historical `exactLength`
- **THEN** the workbench MUST validate that cell only against the configured minimum and maximum string length bounds
- **AND** it MUST NOT block the edit solely because the new value does not equal that historical `exactLength`

### Requirement: Workbench SHALL provide schema-driven Monaco assistance for MML text view
The workbench SHALL use the loaded backend MML rule schema to provide Monaco-style MML editing assistance, including command completion, parameter completion, value suggestions, and validation feedback, while preserving file content as the editing authority.

#### Scenario: Command and parameter completion follow the active MML rule schema
- **WHEN** the user edits an MML-capable workspace file in text view and Monaco has loaded rule schema for the current `networkType + networkVersion`
- **THEN** the editor MUST suggest command heads, parameter names, and parameter values from that schema according to the current statement context
- **AND** parameter suggestions MUST respect declared parameter ordering and already-entered parameters for the active statement

#### Scenario: Value suggestions follow schema value semantics
- **WHEN** the user requests or triggers completion while editing a parameter value in MML text view
- **THEN** enum-style parameters MUST suggest schema enum values
- **AND** string-like, numeric, IP-like, and composite-flag-set-style parameters MUST use schema value hints to choose an appropriate insertion form, snippet shape, or structured edit action

#### Scenario: Text view can open a structured editor for composite flag-set values
- **WHEN** the user places the cursor inside a composite-flag-set-style parameter value in MML text view
- **THEN** the workbench MUST expose a structured edit action that lets the user toggle the declared options for that parameter
- **AND** applying that structured edit MUST replace only the current parameter value text using canonical schema order and enabled-option-only serialization
- **AND** cancelling that structured edit MUST leave the underlying MML text unchanged

#### Scenario: Monaco diagnostics reflect schema-driven rule violations
- **WHEN** the user edits an MML-capable workspace file in text view with schema available
- **THEN** the workbench MUST surface schema-driven validation feedback for issues such as unknown parameters, duplicate parameters, invalid enum values, or missing conditionally required parameters
- **AND** that feedback MUST remain advisory to the text editor path rather than replacing the file content as the source of truth

#### Scenario: Inactive conditional requirements do not produce false-positive diagnostics
- **WHEN** the active statement omits a conditionally required parameter and the schema trigger condition for that parameter is not satisfied
- **THEN** the text view MUST NOT report that parameter as a missing required diagnostic
- **AND** Monaco markers MUST remain absent for that inactive conditional rule

### Requirement: Workbench SHALL render a transient assistant status header for the active conversation view
The authenticated workbench SHALL render a compact status header above assistant message bodies in the active conversation view so the user can see a coarse execution cue during the current turn and a lightweight execution summary after completion.

#### Scenario: Active assistant placeholder shows a coarse in-flight status
- **WHEN** the user submits a prompt and the workbench creates the active assistant placeholder for that turn
- **THEN** the conversation surface MUST render a compact status header above that assistant message body
- **AND** the header MUST present a coarse in-flight status such as queued, thinking, or generating rather than a detailed execution timeline
- **AND** the workbench MUST NOT render that header for user-authored messages

#### Scenario: Tool-assisted turn converges to a compact execution summary
- **WHEN** a completed run returns successfully and the terminal run metrics report one or more tool invocations
- **THEN** the assistant header MUST converge to a short tool-assisted summary for that turn
- **AND** the summary MUST be able to mention the compact tool list without requiring a separate timeline or expanded trace panel

#### Scenario: Interactive or structured turn converges to an outcome-oriented summary
- **WHEN** a completed run returns a terminal output whose kind is `protocol` or `domain-result`
- **THEN** the assistant header MUST converge to a short outcome-oriented summary that reflects that interactive step or structured result
- **AND** the underlying protocol card or rich result message body MUST continue to render through the existing structured message surface

#### Scenario: Awaiting-interaction turn header recovers after user answers the question
- **WHEN** a completed run returns a terminal output whose kind is `awaiting-interaction` and the assistant header shows a waiting-confirmation summary
- **AND** the user subsequently submits an answer through the pending question interaction
- **THEN** the assistant header for that awaiting-interaction message MUST update to an answered summary
- **AND** the header update MUST NOT depend on state stored inside `sessionActivityById` because that state is overwritten by session-list synchronization after each run

#### Scenario: Awaiting-interaction turn header recovers after user rejects the question
- **WHEN** a completed run returns a terminal output whose kind is `awaiting-interaction` and the assistant header shows a waiting-confirmation summary
- **AND** the user subsequently rejects the pending question interaction
- **THEN** the assistant header for that awaiting-interaction message MUST update to a task-ended summary
- **AND** the header update MUST NOT depend on state stored inside `sessionActivityById`

#### Scenario: Failed turn converges to an explicit failure status
- **WHEN** the active run ends with a runtime failure or terminal error result
- **THEN** the assistant header MUST converge to an explicit failed status for that turn
- **AND** the workbench MUST continue to render the failure-oriented assistant body without relying on the header alone as the only user-visible error signal

#### Scenario: Same-session refresh retains the current-turn header without persisting it to history
- **WHEN** the frontend refreshes the currently active session immediately after a completed run in order to reload authoritative session state
- **THEN** the workbench MUST be able to retain the current-turn assistant header presentation for that active view without requiring backend-persisted session history to store intermediate header state
- **AND** the system MUST NOT require that transient header state to remain recoverable after the user later switches sessions or reopens history

### Requirement: Workbench conversation composer SHALL use an upload-first file entry model
The authenticated workbench SHALL treat the conversation composer as the only upload entry surface for workspace materials rather than as a mixed upload-and-create area or a second workspace-management surface.

#### Scenario: Composer primary file action is a compact attachment trigger
- **WHEN** the user views the conversation composer in either the base shell or the workspace-expanded shell
- **THEN** the primary left-side file action MUST render as a compact `+` attachment trigger rather than a text button labeled `上传文件`
- **AND** activating that trigger MUST open the governed file picker immediately

#### Scenario: Composer file picker supports one selection with multiple files
- **WHEN** the user selects more than one supported file from the governed file picker opened by the `+` trigger
- **THEN** the workbench MUST submit all selected files through the normal workspace upload flow
- **AND** the composer MUST NOT require the user to reopen the picker separately for each file in that one selection

#### Scenario: Composer upload can preserve directory-backed input paths
- **WHEN** the user uploads files through the governed composer flow from a directory selection or another source that exposes relative paths
- **THEN** the workbench MUST preserve those relative paths into the resulting `input` workspace tree
- **AND** files inside uploaded folders MUST become openable from the `input` tree after the upload completes

#### Scenario: Manual creation stays outside the composer upload surface
- **WHEN** the user uses the authenticated workbench
- **THEN** the composer MUST NOT present blank-file creation actions
- **AND** the workbench MUST keep manual `+` creation actions confined to the `project` workspace area rather than merging them into the composer upload control

### Requirement: Workbench SHALL render hierarchical trees for `input` and `working`
The workbench SHALL render the underlying `input` and `working` workspace groups as hierarchical trees whenever their entries contain nested path segments or explicit folder nodes, while presenting those trees to the user as `upload` and `project`.

#### Scenario: Project files with nested paths render as a tree
- **WHEN** the `working` group contains paths such as `plans/v1.md` or `plans/mml/core/site.mml`
- **THEN** the sidebar MUST render nested folder nodes under the `project` group rather than flattening those paths into one text row
- **AND** each folder node MUST support expand and collapse behavior

#### Scenario: Upload files inside uploaded folders remain openable from the tree
- **WHEN** the `input` group contains files under nested uploaded folders
- **THEN** the sidebar MUST render those folders as expandable tree nodes under the `upload` group
- **AND** the user MUST be able to open a file from inside that folder hierarchy through the same workspace-open flow

#### Scenario: Folder rows do not pretend to be files
- **WHEN** the user views a folder node in the workspace tree
- **THEN** the sidebar MUST render that row as a folder-specific tree node rather than as a file row
- **AND** activating the folder row MUST expand or collapse the folder instead of opening an editor tab

### Requirement: Workbench SHALL expose a `NEW` action for `working`
The workbench SHALL expose a dedicated compact `+` action inside the workspace sidebar for creating new `working` entries without reusing the composer upload surface.

#### Scenario: Compact `+` is available only for project content
- **WHEN** the user views the workspace sidebar
- **THEN** the sidebar MUST expose a compact `+` action for the `project` area
- **AND** the workbench MUST NOT expose that manual creation action for `upload`

#### Scenario: Compact `+` can create project folders and supported blank files
- **WHEN** the user opens the `+` action menu for the `project` area
- **THEN** the menu MUST expose `新建文件夹`、`新建 TXT`、`新建 MD`、`新建 MML`
- **AND** selecting one of those actions MUST create the corresponding entry under `working`

#### Scenario: Compact `+` uses the current project directory context
- **WHEN** the user triggers the top-level `+` while a `working` folder or file is selected
- **THEN** the created entry MUST default to the `working` root rather than inheriting the selected folder context

#### Scenario: Folder-level `+` uses that folder as create context
- **WHEN** the user triggers the row-level `+` for a `working` folder
- **THEN** the created entry MUST default to that folder context

### Requirement: Workbench SHALL support explicit working folder rename from the tree
The workbench SHALL let users explicitly rename `working` folders from the workspace tree while keeping folder rename within the same parent directory.

#### Scenario: Folder row action exposes rename
- **WHEN** the user opens the secondary action menu for a `working` folder node
- **THEN** the menu MUST expose a `重命名` action for that folder
- **AND** invoking that secondary action MUST NOT also expand the folder row

#### Scenario: Folder rename is inline and basename-only
- **WHEN** the user triggers rename for a `working` folder
- **THEN** the workbench MUST replace the visible folder-name region with an inline editing control
- **AND** the frontend MUST NOT offer UI affordances for moving the folder to another parent directory in that rename flow

#### Scenario: Successful folder rename refreshes the tree in place
- **WHEN** a working-folder rename request succeeds
- **THEN** the renamed folder MUST appear in the tree under its new path
- **AND** descendant file and folder nodes MUST continue to appear under that renamed branch after the workspace metadata refresh

### Requirement: Workbench SHALL auto-save editable workspace files on blur and navigation boundaries
The workbench SHALL auto-save editable workspace files on the first-version navigation boundaries instead of requiring an explicit manual save click for the normal editing flow.

#### Scenario: Editor blur triggers auto-save for an editable dirty file
- **WHEN** an editable workspace file has unsaved local changes and the editor loses focus
- **THEN** the workbench MUST issue a save request for that file automatically
- **AND** a successful save MUST clear the file's dirty state

#### Scenario: Switching active files saves the current dirty file first
- **WHEN** the user attempts to switch from one editable workspace file to another while the current file has unsaved local changes
- **THEN** the workbench MUST attempt to save the current file before completing the active-file switch
- **AND** the target file MUST NOT replace the current editor context until that save either succeeds or fails explicitly

#### Scenario: Closing an editable dirty file saves before the tab closes
- **WHEN** the user closes an editable workspace file tab that still has unsaved local changes
- **THEN** the workbench MUST attempt to save that file before removing the tab from the open editor state
- **AND** a failed save MUST remain visible instead of being silently ignored

### Requirement: Workbench conversation composer SHALL preserve a width-stable primary action row
The authenticated workbench SHALL keep the composer action row stable on supported desktop widths so that the compact attachment trigger and send controls remain readable without deforming the primary send action.

#### Scenario: Send action keeps a stable horizontal shape at constrained desktop widths
- **WHEN** the workbench is rendered in a supported laptop-width desktop layout with limited horizontal space
- **THEN** the send action MUST retain a readable horizontal button shape
- **AND** the workbench MUST NOT collapse that action into a narrow vertical pill solely because the compact attachment trigger competes for width

#### Scenario: Composer row stays minimal and does not reintroduce passive upload chrome
- **WHEN** the composer renders its primary action row
- **THEN** the upload entry cluster MUST remain limited to the compact `+` trigger rather than a text button plus auxiliary help controls
- **AND** the workbench MUST NOT reserve permanent row width for passive upload-copy or separate visible help affordances

### Requirement: Workbench SHALL use a governed typography system across shell and workspace surfaces
The authenticated workbench SHALL use a governed typography system so that shell chrome, conversation surfaces, workspace surfaces, and administrative panels express hierarchy through a small semantic type scale rather than component-local raw size choices.

#### Scenario: Similar shell roles use the same governed typography tier
- **WHEN** the workbench renders repeated hierarchy roles such as eyebrows, meta text, dense list text, panel titles, and section titles across different components
- **THEN** those roles MUST resolve from a shared governed typography scale
- **AND** the frontend MUST NOT rely on unrelated component-local raw font sizes for equivalent hierarchy levels

#### Scenario: Dense operational UI avoids low-value micro-variants
- **WHEN** the workbench renders dense operational surfaces such as rails, sidebars, drawers, cards, and shell controls
- **THEN** the typography system MUST avoid low-value micro-variants such as mixed `10px`, `15px`, `17px`, or narrow small-size responsive clamps for those normal chrome roles
- **AND** the workbench MUST prefer a small semantic size set that keeps hierarchy legible on laptop and desktop widths

### Requirement: Workspace editing surfaces SHALL keep editor and table typography distinct but internally consistent
The workbench SHALL keep editor typography and table typography as governed but separate surface rules so that text editing, structured table browsing, and table editing remain density-stable inside the workspace shell.

#### Scenario: Monaco-backed text editing uses the governed editor typography
- **WHEN** the user opens a text-class workspace file in the Monaco-backed text path
- **THEN** the editor MUST use the governed monospace editor typography for that surface
- **AND** any fallback raw-text editing path MUST use the same editor typography role

#### Scenario: Table-oriented workspace surfaces use the governed table typography
- **WHEN** the user views structured data through the workspace table path, the MML workbook grid, or workbench result tables
- **THEN** those table-oriented surfaces MUST use the governed table typography role rather than inheriting unrelated body or editor typography
- **AND** supporting table metadata such as pills, statuses, or row notes MUST use the governed table-meta role

#### Scenario: Entering table edit mode does not change text hierarchy
- **WHEN** the user edits a value inside a governed table-oriented surface
- **THEN** the edit control MUST preserve the same core typography role as the table cell's browse state
- **AND** entering edit mode MUST NOT cause a visible typography jump solely because the surface switched from read-only display to input control

### Requirement: Markdown preview SHALL keep a document-scoped typography scale inside the workspace shell
The workbench SHALL scope Markdown preview to a document-oriented typography scale without letting that document scale redefine surrounding shell chrome.

#### Scenario: Markdown preview uses a stronger heading scale than shell chrome
- **WHEN** the user switches a Markdown workspace file into preview view
- **THEN** the preview MUST render headings and prose through a document-scoped typography scale appropriate for document reading
- **AND** the surrounding workbench shell MUST continue to use the governed shell typography rather than inheriting Markdown heading sizes

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

### Requirement: Workbench SHALL block ordinary composer actions while a pending question exists
The workbench SHALL treat an unresolved question interaction as the only active way to continue the blocked session task and SHALL prevent the user from dispatching ordinary conversation actions for that session until the interaction is answered or rejected.

#### Scenario: Pending question disables normal composer entry points
- **WHEN** the active session contains a pending question interaction
- **THEN** the workbench MUST disable the normal conversation composer, send action, and upload entry points for that session
- **AND** the user MUST be guided to continue through the pending question UI instead of ordinary chat submission

#### Scenario: Pending question does not dispatch a generic conversation run
- **WHEN** the active session contains a pending question interaction and the user attempts to continue the session
- **THEN** the workbench MUST NOT dispatch that attempt as a generic `/agent/run` conversation input
- **AND** the frontend MUST keep reply / reject as the only supported continuation path for that blocked session

### Requirement: Workbench SHALL continue pending question flows through interaction actions and canonical history
The workbench SHALL resolve pending question interactions through dedicated reply or reject actions and SHALL rely on backend-provided session history for later recovery of the resolved interaction context.

#### Scenario: Answered pending question resumes through reply and continuation
- **WHEN** the user submits a valid answer for a pending question interaction
- **THEN** the workbench MUST call the dedicated interaction-reply path for that interaction
- **AND** the workbench MUST start or request a continuation run in the same session after the reply succeeds

#### Scenario: Rejected pending question resumes through reject and continuation
- **WHEN** the user explicitly rejects a pending question interaction
- **THEN** the workbench MUST call the dedicated interaction-reject path for that interaction
- **AND** the workbench MUST start or request a continuation run in the same session after the reject succeeds

#### Scenario: Reload recovers resolved interaction context from session history
- **WHEN** a session is later reloaded after a question interaction has already been answered or rejected and the backend has persisted the normalized resolved-interaction message in session history
- **THEN** the workbench MUST recover that message through the normal session-history mapping path
- **AND** the frontend MUST NOT require a hidden client-only continuation payload to remember the resolved question context

### Requirement: Workbench SHALL render awaiting-question turns with readable assistant bubble summaries
The workbench SHALL render the assistant bubble for an awaiting-question turn by using the backend-provided readable summary text while keeping the pending-question card as the authoritative structured interaction surface for the same turn.

#### Scenario: Awaiting-question turn shows readable assistant summary plus structured card
- **WHEN** a completed run returns `awaiting-interaction` output for a pending question
- **THEN** the workbench MUST render the assistant bubble body with the backend-provided summary text for that turn
- **AND** the workbench MUST continue to render the pending-question card for the same interaction as the authoritative structured input UI

#### Scenario: Summary bubble does not duplicate option lists or degraded diagnostics
- **WHEN** the pending question interaction contains select options, degraded reference options, or a degraded failure explanation
- **THEN** the assistant bubble MUST remain a concise summary surface
- **AND** the workbench MUST keep detailed options and degraded diagnostics inside the pending-question card rather than duplicating them into the assistant bubble

#### Scenario: Reload preserves the same awaiting-question summary bubble
- **WHEN** the user reloads or reopens a session that already contains a persisted awaiting-question assistant message
- **THEN** the workbench MUST render the same readable assistant summary text from canonical session history
- **AND** the frontend MUST NOT require client-only recomputation from tool traces or transient interaction state to preserve that bubble

### Requirement: Workbench SHALL provide discoverable MML diagnostic feedback in text view
The workbench SHALL make active MML text-view diagnostics discoverable beyond wave-underlines alone so users can understand the current file state without relying on implicit Monaco behavior.

#### Scenario: Hovering a marked range explains the active diagnostic
- **WHEN** the user hovers a text range that currently carries an MML diagnostic marker
- **THEN** the workbench MUST show hover content that explains the active diagnostic message for that range
- **AND** any schema help shown for the same position MUST appear as supporting context rather than replacing the diagnostic explanation

#### Scenario: Text view exposes a file-level diagnostic summary
- **WHEN** the active MML text view has one or more diagnostics
- **THEN** the workbench MUST surface a file-level diagnostic summary in the editor shell
- **AND** that summary MUST include the active diagnostic count and severity mix at least at the warning/error level

#### Scenario: User can inspect diagnostics from an expandable summary surface
- **WHEN** the user activates the text-view diagnostic summary
- **THEN** the workbench MUST expand a dedicated diagnostic list for the active file
- **AND** each diagnostic entry MUST show enough information to distinguish the affected statement and issue message

#### Scenario: Selecting a diagnostic entry returns the user to the affected text
- **WHEN** the user selects an entry from the text-view diagnostic list
- **THEN** the editor MUST move focus to the corresponding text range
- **AND** the workbench MUST keep the diagnostics advisory rather than blocking editing or saving

### Requirement: Workbench SHALL expose spare rows for active MML command sheets without changing text authority
The workbench SHALL render each active MML command sheet with a visible spare-row region so users can continue authoring beyond the current persisted statement count while MML text remains the only saved document authority.

#### Scenario: Active command sheet shows spare rows after persisted statement rows
- **WHEN** the user opens an active MML command sheet in table view
- **THEN** the grid MUST render the persisted statement rows already projected from source text
- **AND** the grid MUST also render a visible spare-row region below those persisted rows so the sheet does not visually end at the last existing statement

#### Scenario: Selecting a spare row explains table-based new-row authoring behavior
- **WHEN** the user selects a cell in the spare-row region of an active MML command sheet
- **THEN** the workbook status feedback MUST indicate that input in that region is used to author a new statement for the active command sheet
- **AND** the workbench MUST NOT treat that spare row as an already-persisted MML statement before a valid edit or paste is committed

#### Scenario: Direct single-cell input into spare rows stays local until the row is valid
- **WHEN** the user focuses a spare-row cell in an active MML command sheet and enters a value through direct typing, paste, or deletion
- **THEN** the workbench MUST allow that edit to update the table-visible new-row state for the targeted row
- **AND** the workbench MUST preserve the underlying MML text unchanged until that row becomes complete and valid under the active sheet schema

#### Scenario: Spare rows and incomplete new rows do not create saved statements by merely being visible
- **WHEN** the user opens or scrolls through a command sheet that shows spare rows, or leaves a spare-row-backed new row incomplete in table view
- **THEN** the underlying MML text content MUST remain unchanged
- **AND** those spare rows or incomplete new rows MUST NOT be serialized as empty, partial, or placeholder statements on save

### Requirement: Workbench SHALL keep incomplete new-row authoring local to the table view
The workbench SHALL allow users to author new MML rows in table view without auto-filling untouched parameters, while keeping incomplete rows as table-local state until they become valid statements.

#### Scenario: Partial input into a spare row records only the touched columns
- **WHEN** the user edits or pastes only a subset of columns for a new row in the spare-row region
- **THEN** the workbench MUST preserve only the values explicitly provided for that new row
- **AND** the workbench MUST NOT auto-fill untouched parameters, schema defaults, or values inferred from other rows or columns

#### Scenario: Missing required parameters are indicated without synthesizing values
- **WHEN** a table-authored new row is missing an unconditional required parameter or a conditional-required parameter
- **THEN** the workbench MUST surface that row as incomplete in table view
- **AND** the workbench MUST visually indicate the missing requirement on the affected row or cells
- **AND** the workbench MUST NOT synthesize or write parameter values on the user's behalf in order to make that row pass validation

#### Scenario: Incomplete new rows survive tab switching inside the current workspace session
- **WHEN** the user leaves a table-authored new row incomplete and switches command tabs, file tabs, or view modes within the current workspace session
- **THEN** the workbench MUST preserve that incomplete new-row state when the user returns to the same file and command sheet

#### Scenario: Save is blocked while incomplete new rows remain
- **WHEN** the active workspace contains one or more incomplete table-authored new rows
- **AND** the user attempts to save the file
- **THEN** the workbench MUST block that save
- **AND** the workbench MUST explain that incomplete table rows must be completed or cleared before save can proceed

### Requirement: Workbench SHALL support transactional MML paste that can update existing rows and append new statements
The workbench SHALL treat spreadsheet paste into an active MML command sheet as one table-authoritative interaction that may update existing persisted rows immediately and may also advance spare-row-backed new rows toward materialization, while MML text remains the only saved document authority.

#### Scenario: Paste may update persisted rows and create additional rows in one operation
- **WHEN** the user pastes a rectangular value range into an active MML command sheet
- **AND** part of the target rectangle maps to existing persisted rows while another part maps to spare rows
- **THEN** the workbench MUST allow that paste to proceed as one operation when all targeted cell values are valid for their target columns
- **AND** the persisted-row portion MUST update the existing statements through the text-first rewrite path
- **AND** the spare-row portion MUST either materialize complete valid statements or remain as incomplete table-local new-row state for the active command sheet

#### Scenario: New rows materialize only explicit values and append in row order once complete
- **WHEN** the user edits or pastes values that make one or more spare-row-backed new rows complete and valid in an active command sheet
- **THEN** the workbench MUST evaluate those new rows using only the values explicitly present in the table for each row together with unconditional required parameters and conditional-required parameters
- **AND** blank cells for those new rows MUST be treated as not-provided values rather than as explicit empty overrides
- **AND** successfully materialized new statements MUST append after the last existing statement of that active command sheet
- **AND** those new statements MUST insert before any consecutive raw segment that already followed that last matching statement
- **AND** multiple new statements that become materializable together MUST append in the same top-to-bottom order as their table rows

#### Scenario: Paste rejects hard validation failures but does not reject merely incomplete new rows
- **WHEN** the user pastes a rectangular value range into an active MML command sheet
- **AND** any targeted persisted row is blocked, any typed value fails validation, or the target rectangle exceeds the available command-sheet range
- **THEN** the workbench MUST reject the entire paste operation
- **AND** the underlying MML text content MUST remain unchanged
- **AND** the workbench MUST NOT silently apply only the valid subset of that paste
- **BUT** the workbench MUST NOT treat a spare-row-backed new row as a hard paste failure solely because that row remains incomplete after the paste

#### Scenario: Typed clipboard values use canonical target-column semantics
- **WHEN** the user copies from or pastes into schema-driven typed cells such as enum, numeric, or composite/bitfield parameters in an active MML command sheet
- **THEN** the workbench MUST interpret pasted text according to the target column schema rather than according to any source-grid UI state
- **AND** enum cells MUST copy and paste their canonical schema values rather than display labels
- **AND** composite or bitfield cells MUST copy and paste canonical serialized values that are revalidated and normalized against the target column schema before save

### Requirement: Workbench SHALL support reading mode for eligible assistant plain-text messages
The authenticated workbench SHALL evaluate completed assistant plain-text messages for reading-mode eligibility and SHALL render eligible messages through a readable markdown-like presentation while keeping short conversational replies in the existing bubble-style presentation. For ordinary multiline text that is rendered through this reading-mode path, the workbench MUST preserve visible line breaks from the original message content instead of collapsing those source newlines into a single visual line. The reading-mode renderer SHALL use marked for GFM-compatible parsing and DOMPurify for output sanitization.

#### Scenario: Structured assistant plain-text reply defaults into reading mode
- **WHEN** the conversation contains a completed assistant plain-text message with strong structured-text signals such as markdown headings, code fences, multi-item lists, GFM table syntax, or longer blank-line-separated paragraphs
- **THEN** the conversation surface MUST render that message through the readable reading-mode presentation by default
- **AND** the frontend MUST NOT require a backend-specific message kind or persisted presentation hint in order to do so

#### Scenario: Reading mode preserves visible line breaks from multiline assistant text
- **WHEN** an eligible completed assistant plain-text message contains source line breaks inside ordinary text content rendered by the reading-mode surface
- **THEN** the conversation surface MUST preserve those source line breaks as visible line breaks in the rendered message body
- **AND** the frontend MUST NOT flatten that multiline content into a single visual line solely because the message entered reading mode

#### Scenario: Short conversational assistant reply stays in the normal bubble path
- **WHEN** the conversation contains a completed assistant plain-text message that reads like a short conversational reply and does not satisfy the frontend's reading-mode eligibility rules
- **THEN** the conversation surface MUST keep that message in the normal plain bubble presentation
- **AND** the workbench MUST NOT force every completed assistant plain-text message into the reading-mode surface

#### Scenario: Streaming assistant text does not switch presentation mid-generation
- **WHEN** an assistant plain-text message is still streaming for the active turn
- **THEN** the conversation surface MUST keep using the existing in-flight text presentation until the message is complete
- **AND** the frontend MUST NOT reflow the message between raw and reading-mode layouts during streaming

#### Scenario: Table-only assistant reply defaults into reading mode
- **WHEN** the conversation contains a completed assistant plain-text message whose content consists of a GFM table (pipe-delimited rows with a separator row) and no other strong structural signals such as headings or code fences
- **THEN** the conversation surface MUST render that message through the reading-mode presentation by default
- **AND** the rendered output MUST display the table as an HTML table rather than raw pipe-delimited text

#### Scenario: Wide table scrolls horizontally inside assistant reading-mode bubble
- **WHEN** a completed assistant plain-text message rendered in reading mode contains a GFM table that exceeds the available bubble width
- **THEN** the table MUST be horizontally scrollable without breaking the surrounding bubble layout
- **AND** the table content MUST NOT be truncated or hidden

#### Scenario: Bare URLs render as clickable links in reading mode
- **WHEN** a completed assistant plain-text message rendered in reading mode contains a bare URL such as `https://example.com`
- **THEN** the reading-mode surface MUST render that URL as a clickable link
- **AND** this behavior change from the previous custom parser is accepted as product behavior

#### Scenario: Reading mode preserves raw-HTML-as-literal-text behavior
- **WHEN** a completed assistant plain-text message rendered in reading mode contains raw HTML tags such as `<script>alert(1)</script>`
- **THEN** the reading-mode surface MUST display those tags as escaped literal text
- **AND** the surface MUST NOT render those tags as effective HTML elements

### Requirement: Workbench SHALL allow a low-profile manual view toggle for eligible assistant plain-text messages
The authenticated workbench SHALL expose a low-profile per-message view toggle for eligible completed assistant plain-text messages so the user can switch between rendered reading mode and raw text without affecting other messages.

#### Scenario: Eligible assistant message shows a manual view toggle near timestamp
- **WHEN** the conversation renders a completed assistant plain-text message that is eligible for reading mode
- **THEN** the message metadata area near the timestamp MUST expose a subtle manual view toggle such as `阅读` or `原文`
- **AND** that toggle MUST apply only to the owning message rather than to the whole conversation

#### Scenario: User can switch an eligible message back to raw text
- **WHEN** the user activates the manual view toggle on an eligible assistant plain-text message currently shown in reading mode
- **THEN** the conversation surface MUST switch that message back to the raw plain-text presentation
- **AND** the surrounding conversation state MUST remain unchanged

#### Scenario: Manual view toggle is not persisted as backend session state
- **WHEN** the user manually switches an eligible assistant plain-text message between reading mode and raw text and later reloads or reopens the session
- **THEN** the workbench MUST recompute the default presentation from message content rather than restoring the earlier manual override
- **AND** the frontend MUST NOT require backend-persisted per-message view state for that toggle

#### Scenario: Structured non-text assistant surfaces remain on their dedicated renderers
- **WHEN** the conversation contains assistant messages whose visible body is owned by protocol, rich result, or failure-specific rendering paths
- **THEN** the workbench MUST continue to render those messages through their existing dedicated message surfaces
- **AND** the assistant plain-text reading-mode toggle MUST NOT replace or interfere with those structured renderers

### Requirement: Workbench conversation composer SHALL keep running feedback subordinate to the stop action
The authenticated workbench SHALL keep generic run-in-progress feedback visually quiet in the conversation composer so the active interruption action remains the clearest control during a running turn.

#### Scenario: Active run keeps send button label stable while disabled
- **WHEN** the selected session has an active run and the conversation composer is visible
- **THEN** the send button MUST remain disabled
- **AND** the send button MUST keep its resting send label instead of switching to a prominent processing label

#### Scenario: Stop remains the explicit interruption affordance during a run
- **WHEN** the selected session has an active run whose stop control is available
- **THEN** the composer MUST render stop as an inline action beside the send control
- **AND** the stop control MUST remain visually distinct from the primary send CTA without implying irreversible deletion

### Requirement: Workbench stop-pending feedback SHALL stay inside the stop control
The authenticated workbench SHALL present stop-pending feedback as a local inline control state rather than as a stronger composer-level or page-level processing surface.

#### Scenario: Stop request shows inline spinner state without extra status bar
- **WHEN** the user requests stop for the current active run and the cancel request is still pending
- **THEN** the stop control MUST remain visible in place and show an inline pending indicator with the stop-pending label
- **AND** the workbench MUST NOT introduce an additional composer-level banner or global status bar solely to represent that pending stop request

#### Scenario: Stop-pending state remains width-stable
- **WHEN** the stop control transitions between its resting label and its stop-pending label
- **THEN** the composer action row MUST remain visually stable without noticeable control-layout shift

### Requirement: Workbench SHALL expose secondary workspace file actions through a row-level action menu
The workbench SHALL expose workspace file secondary actions through a row-level `更多` menu so that download and deletion remain separate from the main file-row selection and open affordances.

#### Scenario: File row keeps its main click area separate from the row action menu
- **WHEN** the user views a file entry in the `工作空间` sidebar tree
- **THEN** that row MUST expose a separate row-action trigger for secondary file actions
- **AND** invoking the row-action trigger MUST NOT also select or open the file

#### Scenario: Row action menu exposes the first-version file actions
- **WHEN** the user opens the row action menu for a workspace file
- **THEN** the menu MUST expose `下载` and `删除` as distinct actions
- **AND** `删除` MUST remain visually distinguishable as the higher-risk action

#### Scenario: Main file row semantics remain unchanged while using row actions
- **WHEN** the user clicks or double-clicks the main file-row area
- **THEN** the workbench MUST preserve the existing single-click selection and double-click open behavior
- **AND** the presence of the row action menu MUST NOT redefine those primary row semantics

### Requirement: Workbench SHALL support downloading workspace files from the sidebar
The workbench SHALL let users download workspace files from the sidebar row action menu without requiring them to open the file in the editor first.

#### Scenario: User downloads a workspace file from the row action menu
- **WHEN** the user chooses `下载` for a workspace file from the row action menu
- **THEN** the frontend MUST issue the scoped workspace download request for that file
- **AND** the browser MUST begin an attachment download for that file without opening or activating the workspace editor

#### Scenario: Download failure remains visible and does not mutate workspace editor state
- **WHEN** the workspace file download request fails
- **THEN** the workbench MUST surface that failure to the user explicitly
- **AND** the sidebar selection, open-file state, and editor content MUST remain unchanged

### Requirement: Workbench SHALL require explicit high-risk confirmation before deleting a workspace file
Before issuing a workspace file delete request, the workbench SHALL require explicit confirmation and SHALL clearly warn that deletion is irreversible and may break current or later workbench execution.

#### Scenario: Delete confirmation warns about irreversible removal and execution risk
- **WHEN** the user triggers delete for any workspace file
- **THEN** the workbench MUST show a confirmation prompt before issuing the delete request
- **AND** that prompt MUST state that deletion cannot be undone
- **AND** that prompt MUST warn that deleting the file may affect the current session or later execution

#### Scenario: Delete confirmation highlights unsaved local changes
- **WHEN** the user triggers delete for a workspace file that currently has unsaved local edits in the editor
- **THEN** the confirmation prompt MUST additionally warn that unsaved changes will be lost if deletion continues

#### Scenario: User may continue deleting a high-risk file
- **WHEN** the file belongs to `output`, is the currently active file, or the current session is running
- **THEN** the workbench MUST still allow the user to confirm deletion
- **AND** the workbench MUST NOT silently block the delete solely because of that risk state

### Requirement: Workbench SHALL reconcile sidebar and editor state after a workspace file is deleted
After a confirmed workspace file deletion succeeds, the workbench SHALL refresh its workspace metadata and reconcile any now-invalid sidebar or editor state.

#### Scenario: Deleted file disappears from the sidebar and open-file state
- **WHEN** a workspace file delete request succeeds
- **THEN** the deleted file MUST be removed from the visible workspace sidebar
- **AND** the workbench MUST remove that file from any open editor tab state

#### Scenario: Deleting the active file reconciles the expanded editor shell
- **WHEN** the deleted file is the currently active workspace editor file
- **THEN** the workbench MUST switch to another remaining open file if one exists
- **AND** the workbench MUST exit the workspace-expanded state if no open files remain

#### Scenario: Delete failure remains visible to the user
- **WHEN** the delete request fails
- **THEN** the workbench MUST preserve the existing file state in the sidebar and editor
- **AND** the workbench MUST surface the failure to the user instead of silently hiding it

### Requirement: Workbench SHALL support explicit workspace file rename from the row action menu
The workbench SHALL let users explicitly rename workspace files from the right-side workspace sidebar row action menu while preserving the existing file-row selection and open interactions. Triggering rename from that menu MUST switch the current file row into an inline rename state instead of opening a browser prompt or detached dialog.

#### Scenario: Row action menu exposes rename alongside existing secondary actions
- **WHEN** the user opens the secondary action menu for a workspace file in the `工作空间` sidebar tree
- **THEN** the menu MUST expose a `重命名` action in addition to the existing secondary file actions
- **AND** using the secondary action menu MUST NOT also trigger file selection or file opening

#### Scenario: Rename starts as inline editing on the same file row
- **WHEN** the user triggers workspace file rename from the row action menu
- **THEN** the workbench MUST replace only the file-name display region on that row with an inline editing control
- **AND** the workbench MUST NOT move the rename interaction into a browser prompt, modal, or detached form surface

#### Scenario: Inline rename does not widen rename scope beyond v1 constraints
- **WHEN** the user edits a file name inline from the workspace row
- **THEN** the workbench MUST collect only a basename change for that file rather than a directory path
- **AND** the frontend MUST NOT offer UI affordances for changing the parent directory or extension as part of v1 rename

### Requirement: Workbench SHALL block destructive workspace file actions for running or dirty files
The workbench SHALL prevent delete and rename requests from being issued when the current session is running or when the targeted workspace file has unsaved local edits.

#### Scenario: Running session blocks destructive workspace file actions
- **WHEN** the current session has an active run in progress
- **THEN** the workbench MUST prevent workspace file delete and rename requests from being issued
- **AND** the user MUST NOT be able to continue through a confirmation flow that bypasses that running-state block

#### Scenario: Dirty file blocks destructive actions for that file
- **WHEN** a workspace file currently has unsaved local edits in the editor
- **THEN** the workbench MUST prevent delete and rename requests for that file from being issued
- **AND** the workbench MUST preserve the current editor state instead of discarding those unsaved edits

### Requirement: Workbench SHALL reconcile sidebar and editor metadata after a successful rename
After a workspace file rename succeeds, the workbench SHALL refresh workspace metadata and update the affected open editor state without replacing the file's stable identity.

#### Scenario: Successful rename updates sidebar and active editor metadata in place
- **WHEN** a workspace file rename request succeeds
- **THEN** the renamed file MUST appear in the workspace sidebar under its new file name and path
- **AND** any open editor tab for that same file MUST keep its stable file identity while updating its visible file name and path

#### Scenario: Rename does not discard the current editable buffer
- **WHEN** a writable workspace file is open in the editor and the rename succeeds
- **THEN** the workbench MUST preserve that file's current editor buffer and local save state
- **AND** the rename flow MUST NOT simulate the change by deleting and re-creating a different frontend file identity

#### Scenario: Rename failure preserves the current workspace view state
- **WHEN** the workspace file rename request fails
- **THEN** the workbench MUST preserve the existing sidebar, tab, and editor state for that file
- **AND** the workbench MUST surface the failure to the user instead of silently mutating local file metadata

### Requirement: Workbench composer SHALL expose a single primary action slot
The workbench conversation composer SHALL use one persistent primary action slot at the end of the composer action row, and that slot MUST switch behavior by conversation runtime state instead of rendering separate send and stop actions side by side.

#### Scenario: Idle composer shows only send in the primary action slot
- **WHEN** the active workbench conversation is not running and the composer is not blocked
- **THEN** the composer MUST render a single send action in the primary action slot
- **AND** the composer MUST NOT render a separate stop action beside it

#### Scenario: Running composer shows only stop in the primary action slot
- **WHEN** the active workbench conversation is running and the current run can be cancelled
- **THEN** the composer MUST replace the send action with a stop action in the same primary action slot
- **AND** the composer MUST NOT keep a disabled send action visible beside the stop action

#### Scenario: Stop request keeps the same slot in a pending state
- **WHEN** the user has requested cancellation for the active run and the workbench is waiting for the terminal run result
- **THEN** the primary action slot MUST remain occupied by the stop control in a pending state
- **AND** the stop control MUST prevent repeated cancellation requests until the run reaches a terminal state

### Requirement: Icon-only composer actions SHALL remain explicit and accessible
The workbench conversation composer SHALL use icon-first primary actions for send and stop while preserving clear runtime meaning, keyboard access, and screen-reader names.

#### Scenario: Send action uses icon-first affordance with accessible naming
- **WHEN** the composer renders the idle primary action
- **THEN** the send action MUST present an icon-first affordance rather than a text-only button label
- **AND** the action MUST expose an accessible name equivalent to “发送消息”

#### Scenario: Stop action remains visually distinct from send
- **WHEN** the composer renders the running or stop-pending primary action
- **THEN** the stop action MUST use a stop-specific iconography that is distinct from the send action
- **AND** the action MUST preserve danger-state visual semantics without relying on color alone

#### Scenario: Composer does not render a persistent stop side-effect note
- **WHEN** the composer renders its action row in any runtime state
- **THEN** the composer MUST NOT display a persistent inline note describing stop side effects beneath the primary action row

### Requirement: Workbench assistant headers SHALL use runtime-configured tool display names
The workbench SHALL use the runtime-provided tool display-name mapping and governed skill display metadata when rendering assistant header labels so that in-flight tool calls and completed-turn summaries present the same user-visible names for the current agent surface.

#### Scenario: In-flight header shows configured tool display name
- **WHEN** the workbench receives a `tool.started` event for the active assistant turn
- **THEN** the in-flight assistant header MUST use the event's configured `displayName`
- **AND** the header MUST NOT recompute or replace that configured name with a frontend-hardcoded alias

#### Scenario: Completed summary reuses bootstrap tool display-name mapping
- **WHEN** a completed run reports tool metrics for one or more invoked tools
- **AND** runtime bootstrap has provided a display-name mapping for those tool identifiers
- **THEN** the completed assistant header summary MUST use the configured display names from that mapping
- **AND** the completed summary MUST present the same user-visible names that were used for the corresponding in-flight tool calls

#### Scenario: Skill-triggered summary uses governed user-visible skill name
- **WHEN** a completed run reports that a managed skill was triggered for the active agent surface
- **THEN** the completed assistant header MUST render the `Skill:` mechanism word together with that governed user-visible skill name
- **AND** the workbench MUST NOT display the raw canonical skill name or `skillId` in that user-visible summary

#### Scenario: Completed summary falls back without configured mapping
- **WHEN** a completed run reports a tool identifier that is not present in the runtime bootstrap display-name mapping
- **THEN** the completed assistant header MUST still render a compact tool summary
- **AND** the workbench MUST fall back to the existing normalized tool-name display instead of hiding the tool reference entirely

### Requirement: Workbench SHALL restrict workspace rename input to the editable file name stem
The workbench SHALL present workspace file rename as a stem-only inline edit operation. The frontend MUST preserve the existing extension for supported workspace files, MUST submit the recomposed full file name to the backend rename API, and MUST provide explicit keyboard and focus semantics for completing or cancelling the inline edit.

#### Scenario: Inline rename defaults to the current file name stem
- **WHEN** the user triggers rename for a workspace file whose current name is `input.csv`
- **THEN** the rename interaction MUST present `input` as the editable inline value rather than `input.csv`
- **AND** the interaction MUST indicate that the existing `.csv` extension is preserved as a non-editable suffix on the same row

#### Scenario: Enter or blur submits the recomposed file name
- **WHEN** the user renames `input.csv` by entering the new stem `input-renamed`
- **AND** the user confirms with `Enter` or ends the inline edit by moving focus away from that control
- **THEN** the frontend MUST call the backend rename API with the full file name `input-renamed.csv`
- **AND** the workbench MUST continue to show the renamed file as `input-renamed.csv` after the rename succeeds

#### Scenario: Escape cancels inline rename without issuing a request
- **WHEN** the user is editing a workspace file name inline
- **AND** the user presses `Escape`
- **THEN** the workbench MUST exit the inline rename state for that row
- **AND** the frontend MUST NOT issue a rename request for that cancellation path

#### Scenario: Unchanged inline rename exits without issuing a request
- **WHEN** the user finishes inline rename without changing the editable stem value
- **THEN** the workbench MUST exit the inline rename state
- **AND** the frontend MUST NOT issue a rename request for that no-op path

#### Scenario: Files without an extension remain fully editable
- **WHEN** the user triggers rename for a workspace file whose current name has no extension
- **THEN** the rename interaction MUST allow editing the full current name inline
- **AND** the frontend MUST submit the edited value without appending an extension

### Requirement: Workbench SHALL render one shared notes field for pending select questions
The workbench SHALL render exactly one optional `notes` input for each pending question interaction that contains a `select` answer path so users can submit supplementary context without changing the structured primary answer.

#### Scenario: Pending select question shows one optional notes input
- **WHEN** the active session contains a pending question interaction with at least one `select` field
- **THEN** the pending question card MUST render exactly one optional `notes` input in addition to the primary answer controls
- **AND** the workbench MUST NOT render multiple independent free-text supplement fields for the same pending interaction

#### Scenario: Notes submission stays separate from the primary answer
- **WHEN** the user submits a pending select question with both a selected answer and a `notes` value
- **THEN** the workbench MUST submit the selected answer as the structured primary answer
- **AND** the workbench MUST submit `notes` as supplementary context rather than as a replacement for the selected option

### Requirement: Workbench SHALL render degraded question interactions with preserved reference context
The workbench SHALL render degraded question interactions as dedicated pending-question cards that preserve the failed question's prompt and any extracted reference option text so the user can continue through the same interaction UI instead of switching back to ordinary chat submission.

#### Scenario: Degraded question card shows reason and reference options
- **WHEN** the active session contains a degraded pending question interaction
- **THEN** the pending question card MUST display a user-readable explanation that structured question collection failed
- **AND** the card MUST continue to show the original prompt
- **AND** the card MUST show any backend-provided reference option text as non-clickable guidance for the user's manual answer

#### Scenario: Degraded question card submits answer plus notes through reply flow
- **WHEN** the user submits a degraded pending question interaction
- **THEN** the workbench MUST send the required text `answer` and any optional `notes` value through the dedicated interaction-reply path
- **AND** the frontend MUST NOT dispatch that degraded answer as a generic `/agent/run` chat message

### Requirement: Workbench SHALL collapse intermediate assistant plain-text steps into an expandable process section
The workbench SHALL reduce conversation noise from multi-step assistant updates by presenting one default-visible main assistant bubble together with an expandable process section. The process section SHALL accept both plain-text and tool-step message types. For tool-step messages, the section SHALL render each tool's display name as a separate line item instead of showing LLM-generated text.

#### Scenario: Consecutive assistant text and tool-step messages collapse into one main bubble
- **WHEN** the conversation history contains two or more consecutive completed assistant messages (plain-text or tool-step) within the same contiguous assistant segment
- **THEN** the workbench MUST render the last plain-text message in that segment as the default-visible main assistant bubble
- **AND** the workbench MUST render the earlier messages from that segment inside a collapsed process section rather than as separate default-visible bubbles

#### Scenario: Single assistant text message stays unchanged
- **WHEN** a contiguous assistant segment contains only one completed assistant text message
- **THEN** the workbench MUST render that message as a normal assistant bubble
- **AND** the workbench MUST NOT add a process-folding affordance for that single message

#### Scenario: Streaming or structured assistant messages do not reflow into folded history mid-turn
- **WHEN** the active turn is still streaming or the conversation contains assistant `protocol`, `result`, or `error` messages
- **THEN** the workbench MUST keep those in-flight or structured messages on their existing dedicated render paths
- **AND** the frontend MUST only apply the process-folding presentation to completed assistant history segments

#### Scenario: Tool-step messages in collapsed section render per-tool display names
- **WHEN** a collapsed process section contains a tool-step message with `toolDisplayNames` array
- **THEN** the workbench MUST render each display name as a separate line item within that step's container
- **AND** the workbench MUST NOT render any LLM-generated text for that tool-step message

#### Scenario: Tool-step message with multiple tools renders all tools as separate lines
- **WHEN** a single tool-step message has `toolDisplayNames` containing multiple entries (e.g., `['读取工作区文件', '查看工作区目录']`)
- **THEN** the workbench MUST render each entry as its own line within the same step container
- **AND** the lines MUST appear in the same order as the `toolDisplayNames` array

#### Scenario: Pure tool-step segment without trailing text forms a tool-step group
- **WHEN** a contiguous assistant segment consists entirely of completed `tool-step` messages with no trailing plain-text message
- **THEN** the workbench MUST merge those tool-step messages into a single tool-step group display item
- **AND** the workbench MUST render each tool's display name as a line item within the group
- **AND** the workbench MUST NOT render empty bubbles for those tool-step messages

#### Scenario: Standalone tool-step message renders tool names instead of empty bubble
- **WHEN** a single `tool-step` message is rendered as an independent display item (not part of any group)
- **THEN** the workbench MUST render the tool display names from `toolDisplayNames` as line items
- **AND** the workbench MUST NOT render an empty bubble with no visible content

#### Scenario: Mixed segment ending with tool-step renders tool-step with visible content
- **WHEN** a contiguous assistant segment contains both plain-text and tool-step messages but ends with a tool-step message
- **THEN** the workbench MUST render each message as an independent display item
- **AND** each tool-step message MUST render its `toolDisplayNames` as visible line items instead of an empty bubble

### Requirement: Workbench SHALL rewrite resolved question continuation history into user-readable answer summaries
The workbench SHALL rewrite resolved Question Tool continuation messages into user-readable history bubbles so that users see the submitted answer content or rejection outcome instead of raw `[INTERACTION CONTEXT]` payload text, internal identifiers, or answer JSON.

#### Scenario: Answered question history shows concrete selected or entered values
- **WHEN** the frontend loads a resolved question continuation message together with its answered interaction metadata
- **THEN** the history bubble MUST show a readable answer summary using the interaction field labels
- **AND** any `select` answer MUST display the chosen option label rather than an internal option value
- **AND** any free-text field or `notes` field MUST display the actual user-entered text

#### Scenario: Rejected question history does not expose raw interaction context
- **WHEN** the frontend loads a resolved question continuation message whose interaction status is `rejected`
- **THEN** the history bubble MUST present an explicit user-readable rejection summary
- **AND** the bubble MUST NOT display raw `[INTERACTION CONTEXT]`, `interaction_id`, `question_id`, or serialized answer payload text

#### Scenario: Reload restores the same question summary presentation
- **WHEN** the user reloads or reopens a session that already contains resolved question continuation history
- **THEN** the workbench MUST rebuild the same readable question summary presentation from persisted history plus resolved interaction metadata
- **AND** the frontend MUST NOT require a client-only cached summary to preserve that rendering

### Requirement: Workbench conversation composer SHALL support direct drag-and-drop upload on the composer surface
The authenticated workbench SHALL allow users to drag supported files directly onto the composer surface so that drag-and-drop upload follows the same governed attachment flow as the `+` trigger without expanding into a whole-page drop target.

#### Scenario: Dragging supported files highlights only the composer surface
- **WHEN** the user drags one or more supported files over the composer area in either the base shell or the workspace-expanded shell
- **THEN** the workbench MUST highlight only the composer surface as the active drop target
- **AND** the workbench MUST NOT dim or convert the entire page into a global drop zone

#### Scenario: Dropping multiple supported files reuses the normal upload flow
- **WHEN** the user drops multiple supported files onto the highlighted composer surface
- **THEN** the workbench MUST submit all dropped files through the normal workspace upload flow
- **AND** the resulting uploaded entries MUST become available in the workspace sidebar just as if they were selected from the file picker

#### Scenario: Unsupported drag-and-drop files fail explicitly
- **WHEN** the user drops a file whose type is outside the governed `TXT / MD / CSV` upload contract
- **THEN** the workbench MUST reject that drop explicitly
- **AND** the failure MUST remain visible to the user rather than silently ignoring the dropped file

### Requirement: Workbench SHALL expose shared-workspace scope and remaining lock reasons through hover/focus help
The workbench SHALL keep shared-workspace explanations lightweight by omitting a persistent shared-workspace title row and limiting any remaining shared-scope explanation to hover/focus help on relevant surfaces, while continuing to expose send-lock and bulk-clear unavailability reasons through hover/focus help instead of persistent instructional banners or toast-based explanations.

#### Scenario: Workspace area omits a persistent shared title row
- **WHEN** the user views the workspace sidebar or workspace-open shell for the active agent
- **THEN** the workspace tree MUST NOT render a separate persistent title row such as `共享工作区`
- **AND** any shared-workspace explanation that remains available MUST appear only through hover/focus help rather than persistent copy

#### Scenario: Locked send action explains the current session lock reason on hover or focus
- **WHEN** the send action is unavailable because the current session already has an active run or an unresolved pending question
- **THEN** the workbench MUST expose hover/focus help that explains the current session must finish or resolve that question before sending again
- **AND** the workbench MUST NOT rely on a transient toast as the primary explanation for that locked state

#### Scenario: Active-session delete remains available through the history rail
- **WHEN** a historical session still has an active run, is stop-pending, or is waiting for a question response
- **THEN** the workbench MUST keep that session's delete action available in the history rail
- **AND** the delete confirmation MUST explain that deleting the session will immediately terminate and clean up that active state

#### Scenario: Unavailable bulk-clear action explains that no idle history is deletable
- **WHEN** the bulk-clear history action is unavailable because no historical session is currently deletable after excluding the current session and preserving active sessions
- **THEN** the workbench MUST expose hover/focus help that explains there is no idle history available to clear
- **AND** the workbench MUST NOT rely on a transient toast as the primary explanation for that unavailable state

### Requirement: Workbench SHALL keep the workspace sidebar compact while revealing complete file names
The workbench SHALL keep workspace file rows in a compact single-line tree layout and SHALL preserve full file-name readability through explicit reveal behavior instead of allowing long names to become permanently unreadable. When a file name exceeds the available sidebar width, the rendered label MUST preserve file extension recognizability.

#### Scenario: Long file names remain compact without losing extension recognizability
- **WHEN** the workspace sidebar renders a file whose name exceeds the available row width
- **THEN** the row MUST remain single-line and compact
- **AND** the rendered label MUST preserve the file extension as recognizable text
- **AND** the sidebar MUST NOT switch to a default multi-line file-row layout

#### Scenario: Pointer hover reveals the complete file name
- **WHEN** a user hovers a workspace file row whose rendered label is truncated
- **THEN** the workbench MUST reveal the complete file name for that row
- **AND** the revealed value MUST match the exact current file name

#### Scenario: Keyboard focus reveals the complete file name
- **WHEN** keyboard focus moves onto a workspace file row whose rendered label is truncated
- **THEN** the workbench MUST reveal the complete file name for that row
- **AND** the reveal behavior MUST NOT require pointer hover to work

### Requirement: Workbench upload conflict confirmation SHALL use a product-owned confirmation surface
The workbench SHALL replace browser-native confirmation for upload path conflicts with a product-owned confirmation surface so users can decide whether to overwrite an existing workspace file without leaving the workbench interaction model.

#### Scenario: Conflicting upload opens a product confirmation surface
- **WHEN** the normal composer upload flow receives an `UPLOAD_CONFLICT` response for a selected file
- **THEN** the workbench MUST open a product-owned confirmation surface before issuing any overwrite retry
- **AND** the confirmation surface MUST identify the conflicting workspace-relative path
- **AND** the confirmation surface MUST warn that continuing will overwrite the current file content
- **AND** the frontend MUST NOT invoke a browser-native confirmation dialog for that conflict

#### Scenario: Canceling or dismissing upload conflict confirmation does not overwrite the file
- **WHEN** the upload conflict confirmation surface is open and the user clicks `取消`, presses `Esc`, or dismisses the surface by clicking outside it
- **THEN** the workbench MUST close the confirmation surface
- **AND** the workbench MUST NOT retry the upload with overwrite enabled for that file

#### Scenario: Confirmed upload conflict retries overwrite through the existing upload flow
- **WHEN** the upload conflict confirmation surface is open and the user confirms the overwrite action
- **THEN** the workbench MUST retry that same file through the existing upload flow with overwrite enabled
- **AND** a successful retry MUST make the updated file available through the existing workspace refresh path

#### Scenario: Multi-file upload resolves conflicts one at a time
- **WHEN** one file in a multi-file upload selection opens the upload conflict confirmation surface
- **THEN** the workbench MUST pause the remaining upload queue until the user resolves that conflict
- **AND** after the user confirms or cancels that conflict, the workbench MUST continue processing the remaining selected files in order

### Requirement: Workbench SHALL gate run creation by session activity state
The workbench SHALL determine sendability, stop control, and pending-question continuation by the currently selected session's own activity state rather than by another session's shared-workspace occupancy.

#### Scenario: Another session's active run does not block the current session from sending
- **WHEN** one session in the current shared workspace already has an active run or an unresolved pending question and the user switches to a different idle session
- **THEN** the workbench MUST allow the user to submit a new run from that different session
- **AND** the workbench MUST keep the shared workspace presentation unchanged while doing so

#### Scenario: New conversation can send even while another session is active
- **WHEN** the user creates a new conversation while another session in the same shared workspace is active
- **THEN** the workbench MUST enter the normal blank-draft conversation shell
- **AND** the workbench MUST allow the first prompt to create a backend session and start a run without waiting for the other session to finish

#### Scenario: Returning to an active session restores that session's stop affordance
- **WHEN** the user switches away from and later returns to a session that still owns an active run
- **THEN** the workbench MUST restore the stop affordance for that same session
- **AND** the workbench MUST NOT transfer stop control to a different session merely because it became the active view earlier

#### Scenario: Pending question blocks ordinary send only in the owning session
- **WHEN** the current session contains an unresolved pending question interaction
- **THEN** the workbench MUST prevent ordinary send for that same session
- **AND** the workbench MUST require the user to continue through the dedicated question reply or reject flow
- **AND** the workbench MUST NOT block ordinary send in a different idle session solely because of that pending question

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

### Requirement: Workbench working-group `NEW` menu SHALL support explicit dismiss interactions
The workbench SHALL allow users to dismiss the working-group `+` creation menu through standard pointer and keyboard interactions, and MUST NOT require a second click on the same trigger as the only closing path.

#### Scenario: Outside pointer interaction closes the opened `+` menu
- **WHEN** the user opens the working-group `+` menu in the workspace sidebar
- **AND** the user performs a primary pointer interaction outside the `+` trigger and dropdown region
- **THEN** the workbench MUST close the `+` menu

#### Scenario: Escape key closes the opened `+` menu
- **WHEN** the user opens the working-group `+` menu in the workspace sidebar
- **AND** keyboard focus remains within the workbench document
- **AND** the user presses `Escape`
- **THEN** the workbench MUST close the `+` menu

#### Scenario: Trigger toggle behavior remains available
- **WHEN** the user opens the working-group `+` menu and clicks the same `+` trigger again
- **THEN** the workbench MUST close the `+` menu

#### Scenario: Choosing a creation action closes the menu before inline creation state
- **WHEN** the user opens the working-group `+` menu and selects a creation action
- **THEN** the workbench MUST close the dropdown menu
- **AND** the workbench MUST enter the corresponding inline creation input state

### Requirement: Workbench SHALL scope conversation status surfaces to the owning session
The workbench SHALL derive conversation-scoped status text, plan summary, and terminal run state from the owning session rather than from a workspace-global mutable field so that background session activity cannot overwrite the active session's context pane.

#### Scenario: Background session lifecycle updates do not overwrite the viewed session context pane
- **WHEN** session A is running in the background, the user is currently viewing session B, and session A emits a plan snapshot, runtime error, or terminal run event
- **THEN** the workbench MUST keep session B's context pane bound to session B's own status and plan summary
- **AND** the workbench MUST NOT render session A's lifecycle text or plan summary inside session B's context pane

#### Scenario: Returning to a background session restores its own latest conversation status
- **WHEN** session A produces plan or terminal lifecycle updates while another session is active and the user later switches back to session A
- **THEN** the workbench MUST render session A's own latest conversation status and plan summary
- **AND** the workbench MUST NOT require those values to have been visible while another session was active

### Requirement: Workbench SHALL discard stale session hydration responses
The workbench SHALL treat session selection and explicit session reloads as versioned session hydrations and MUST ignore any response that is no longer current for the target session.

#### Scenario: Older response for the same session does not overwrite a newer view
- **WHEN** two or more hydration requests for the same session are in flight and an older response resolves after a newer response has already been applied
- **THEN** the workbench MUST discard the older response
- **AND** the workbench MUST preserve the messages, interactions, and derived session summary from the newer response

#### Scenario: Inactive session hydration does not mutate the current view
- **WHEN** a hydration response resolves after the user has switched to a different active session
- **THEN** the workbench MUST NOT overwrite the current visible session's messages, interactions, or derived conversation summary

### Requirement: Workbench SHALL reconcile run cleanup against the run-owning session
The workbench SHALL bind optimistic assistant placeholders, run activity state, error recovery, and terminal cleanup to the session that created the run instead of to whichever session happens to be active when async work settles.

#### Scenario: Run failure after a session switch clears only the owning session
- **WHEN** session A starts a run, the user switches to session B before that run fails, and the failure is later observed by the frontend
- **THEN** the workbench MUST clear session A's optimistic run state and record the failure against session A
- **AND** the workbench MUST NOT clear session B's run state or overwrite session B's conversation messages because of session A's failure

#### Scenario: Background cancellation or completion leaves unrelated sessions untouched
- **WHEN** a background session reaches cancelled or terminal completion while another session is active
- **THEN** the workbench MUST reconcile lifecycle cleanup against the background session that owns the run
- **AND** the workbench MUST leave the currently viewed session's lifecycle state unchanged unless that viewed session owns the same run

### Requirement: Workbench SHALL preserve the visible running assistant placeholder while rehydrating an active session
The workbench SHALL preserve a session's local running assistant placeholder when the user reopens a still-running session before authoritative persisted assistant history is available.

#### Scenario: Switching back to a running session keeps the assistant placeholder visible
- **WHEN** the user sends a prompt in `sessionA`, switches to another session, and quickly switches back while `sessionA` is still in `running` or `stop-pending`
- **AND** the reloaded session history does not yet contain the persisted assistant message for that run
- **THEN** the workbench MUST continue showing the local assistant placeholder bubble for `sessionA`
- **AND** the workbench MUST NOT regress to showing only the user bubble for that in-flight turn

#### Scenario: Background stream updates continue targeting the preserved placeholder
- **WHEN** a running session's local assistant placeholder has been preserved during session rehydration
- **AND** later stream events for that same run arrive after the user has switched away and back
- **THEN** the workbench MUST continue applying those updates to the preserved assistant placeholder
- **AND** the visible assistant bubble MUST continue reflecting the latest streamed state for that run

#### Scenario: Authoritative persisted history replaces the transient placeholder without duplication
- **WHEN** the workbench later reloads a running session and the authoritative session history now contains the persisted assistant message for that run
- **THEN** the workbench MUST prefer the persisted assistant message as the visible record
- **AND** the workbench MUST remove the transient local placeholder for that run
- **AND** the workbench MUST NOT render duplicate assistant bubbles for the same turn

### Requirement: Workbench SHALL present normalized readable text for uploaded workspace files
The workbench SHALL rely on the runtime's UTF-8-normalized upload contract so that supported uploaded text files open as readable text in the workspace editor without requiring the user to repair encoding manually.

#### Scenario: Chinese upload opens without mojibake
- **WHEN** a user uploads a supported Chinese text file encoded as UTF-8, UTF-16 with BOM, or GB18030-family text and then opens it from the workspace sidebar
- **THEN** the workbench MUST render readable Chinese text in the workspace editor
- **AND** the user MUST be able to continue editing and saving that file through the normal workspace flow

#### Scenario: Normalized upload remains readable after save and reopen
- **WHEN** a user opens an uploaded text file that was normalized to UTF-8 during upload, saves edits, closes it, and later reopens it
- **THEN** the workbench MUST continue to render readable text for that same workspace file
- **AND** the workbench MUST NOT require the user to choose or reapply an encoding setting during the normal workspace flow

#### Scenario: Unsupported encoded upload does not enter editor flow
- **WHEN** the runtime rejects an uploaded supported file because the content encoding is unsupported or not valid text
- **THEN** the workbench MUST surface the upload failure instead of showing a garbled editor view for that file
- **AND** the rejected file MUST NOT appear as a successfully opened editable workspace file

### Requirement: Workbench SHALL refresh open non-dirty workspace files after successful tool-driven runs
The workbench SHALL reload editor content for currently open workspace files after a successful run changes workspace files, provided those files do not contain unsaved local edits. Users MUST NOT need to reload the entire page to see updated content for open non-dirty files.

#### Scenario: Active open file shows refreshed content after successful run
- **WHEN** a workspace file is already open in the editor, the file has no unsaved local edits, and a successful run changes that file in the workspace
- **THEN** the workbench MUST fetch the file's latest content after session/workspace reload completes
- **AND** the active editor view MUST show the refreshed content without requiring the user to manually close the tab or reload the page

#### Scenario: Inactive open tab is refreshed while remaining open
- **WHEN** multiple workspace files are open, one of the inactive open tabs has no unsaved local edits, and a successful run changes that file in the workspace
- **THEN** the workbench MUST refresh that file's cached editor content during post-run reconciliation
- **AND** returning to that tab later MUST show the latest content without requiring another backend file-open request triggered by a full page reload

#### Scenario: Dirty open file is not overwritten by automatic refresh
- **WHEN** a workspace file is open with unsaved local edits and a successful run changes the corresponding workspace file on disk
- **THEN** the workbench MUST NOT replace the dirty editor content during automatic post-run reconciliation
- **AND** the user's local unsaved content MUST remain visible until the user explicitly saves or discards it

### Requirement: Workbench SHALL present layered runtime failure feedback in the conversation surface
The workbench SHALL present runtime failures with distinct user-facing summary, status feedback, and optional technical detail so that users can understand whether a run is retrying, recovering, cancelled, or terminally failed without reading raw backend error text.

#### Scenario: Model timeout shows user-facing summary instead of raw transport detail
- **WHEN** the active run ends with a model timeout or stream interruption runtime error
- **THEN** the conversation failure card MUST display the structured user-facing runtime summary
- **AND** the workbench MUST NOT display raw transport detail, request URL, or equivalent backend diagnostic text as the default body copy in that card

#### Scenario: Recovering tool failure remains a process state instead of a terminal error card
- **WHEN** the workbench receives a tool failure event that indicates the runtime is retrying or recovering
- **THEN** the active assistant message MUST update its visible process status to communicate recovery in progress
- **AND** the workbench MUST NOT render that intermediate tool failure as a terminal red error card

#### Scenario: Terminal tool failure shows user-safe conclusion with optional technical detail
- **WHEN** the active run ends because a tool failure has become terminal
- **THEN** the workbench MUST render a terminal failure card whose primary message comes from the structured user-facing runtime summary
- **AND** the workbench MUST identify the failure as a tool-stage failure in its visible status treatment
- **AND** any technical detail associated with that failure MUST remain optional rather than displayed as the default message body

#### Scenario: Failure feedback is announced accessibly
- **WHEN** the workbench renders a terminal failure card or an in-progress recovery status update
- **THEN** terminal failure feedback MUST be exposed through an assertive accessible error announcement
- **AND** non-terminal recovery status MUST be exposed through a non-terminal status announcement rather than color-only styling

### Requirement: Workbench SHALL provide current-file text search controls in the workspace editor shell
When the user opens an editable text-based workspace file in the workbench editor shell, the shell SHALL expose a mouse-friendly current-file search flow that keeps the default toolbar compact while making search, replace, and undo discoverable.

#### Scenario: Text editor toolbar stays compact by default
- **WHEN** the user views a supported text-based workspace file in text view and the search flow is not expanded
- **THEN** the workbench toolbar MUST show `搜索`, `保存`, and `更多` as the visible editing actions
- **AND** the toolbar MUST NOT render `替换` as a separate always-visible top-level action

#### Scenario: Search button expands an inline current-file search bar
- **WHEN** the user clicks `搜索` while a supported text-based workspace file is active in text view
- **THEN** the workbench MUST expand an inline search bar above the current editor content instead of opening a modal
- **AND** that search bar MUST scope its search behavior to the currently open file only
- **AND** the search bar MUST expose search input, `上一个`, `下一个`, and `关闭`

#### Scenario: Replace controls stay nested inside the search flow
- **WHEN** the inline search bar is open and the user chooses to reveal replace controls
- **THEN** the workbench MUST show the replace input within the same inline search area
- **AND** the replace area MUST expose `替换当前` and `全部替换`
- **AND** those replace actions MUST apply only to matches in the currently open file

#### Scenario: Undo is available from the more menu for text editing
- **WHEN** a supported text-based workspace file is active in text view and the user opens `更多`
- **THEN** the menu MUST expose a clickable `撤销` action
- **AND** triggering `撤销` MUST revert only the current text editor's text-edit history
- **AND** that action MUST NOT claim to undo table-view edits or workspace-wide changes

#### Scenario: Non-text views do not imply unsupported search scope
- **WHEN** the active file is shown in preview view or table view instead of text view
- **THEN** the workbench MUST NOT present the inline current-file text search bar as an active editing surface for that view
- **AND** the shell MUST NOT imply that search or replace is operating across the whole workspace

### Requirement: Workbench SHALL show session token totals only in admin history management
The workbench SHALL expose session-level token totals only to `admin` and `super_admin` users inside the history-management panel. This usage display MUST remain absent from the current conversation surface and from ordinary non-admin views.

#### Scenario: Admin sees a weak token badge in history management
- **WHEN** an `admin` or `super_admin` opens the history-management panel and a session usage summary is available
- **THEN** the workbench MUST render that session's cumulative token total as a weak metadata badge within the corresponding history item
- **AND** the badge MUST remain visually secondary to the session title and update time

#### Scenario: Non-admin sees no token usage metadata
- **WHEN** a non-admin user opens the history-management panel
- **THEN** the workbench MUST NOT request or render session token totals for the listed sessions
- **AND** the history item layout MUST NOT reserve placeholder space for a hidden token badge

#### Scenario: Current conversation surface does not show session totals
- **WHEN** any user views the active conversation shell for the current session
- **THEN** the workbench MUST NOT render the session's cumulative token total in the conversation header, composer, or message area
- **AND** token totals MUST remain scoped to the history-management panel

#### Scenario: Token usage load failure does not block history interaction
- **WHEN** the history-management panel fails to load token usage for one or more sessions
- **THEN** the workbench MUST keep the history list, session selection, and ordinary conversation flow available
- **AND** it MUST NOT replace the failed token value with a fake `0 tok` badge
