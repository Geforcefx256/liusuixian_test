## Context

当前工作区文件契约围绕 `text | csv | mml` 展开：后端上传白名单不接受 `.md`，运行时打开文件时不会把 Markdown 识别为独立模式，前端工作区编辑壳也只区分普通文本、CSV 和 MML。结果是产品内部已经大量存在的 Markdown 文档无法进入一致的工作区体验，只能停留在仓库文件、计划产物或外部文档层面。

这次变更跨越 `apps/agent-backend` 和 `apps/web`。后端需要扩展上传与文件模式识别契约，前端需要引入 Markdown 预览路径，并把 Markdown 从当前 `text` 分支中拆出来，以避免继承 MML 解析入口和表格视图心智。

## Goals / Non-Goals

**Goals:**
- 让工作区支持 `.md` 文件的上传、打开、保存和继续处理。
- 为 Markdown 建立独立于普通文本和 MML 的文件模式与编辑器分支。
- 为 Markdown 提供可切换的编辑视图和预览视图。
- 保持 Markdown 文件继续通过现有 `artifact_ref`、活动文件上下文和工作区文件流转参与工作台流程。
- 保持 Markdown 文件的主工具栏保存状态和保存动作与当前文本文件工作区体验一致。

**Non-Goals:**
- 不在本次变更中引入 Markdown 的业务语义角色，如 `plan`、`report`、`note`。
- 不新增后端 Markdown 预渲染接口。
- 不在本次变更中重构工作区分组模型，仍保持现有 `input/output` 结构。
- 不扩展为完整文档系统能力，如目录树、锚点导航、批注、双栏同步滚动。

## Decisions

### 1. Workspace file mode expands to `markdown`

工作区文件契约将从 `text | csv | mml` 扩展为 `text | markdown | csv | mml`。运行时以文件扩展名识别 `.md` 并返回 `markdown` 模式；普通纯文本仍使用 `text`，MML 仍以识别到的头部元数据升级为 `mml`。

这样可以让 Markdown 在工作区中成为一等文件类型，而不必先引入更重的文档语义模型。

**Alternatives considered**
- 继续复用 `text`：实现最小，但会让 `.md` 继承当前 `text` 分支里的 MML 入口与错误文案，不符合产品心智。
- 直接引入文档角色模型：方向更完整，但范围显著超出当前需求。

### 2. Markdown preview stays frontend-owned

Markdown 预览在前端工作区中完成，而不是由后端返回预渲染 HTML。工作区编辑器已经是前端主导的本地交互面，预览切换也需要和编辑状态保持紧密联动，因此预览应由前端在当前文件内容基础上即时生成。

这意味着前端需要引入 Markdown 渲染能力，并明确 HTML 清洗策略，避免直接暴露未受控的 `v-html` 渲染路径。

**Alternatives considered**
- 后端提供 Markdown 预览接口：可集中处理渲染和清洗，但会把本地文件编辑能力升级为新的服务端契约，范围过大。
- 本次不做预览，只做语法高亮：无法达到“产品化支持”的目标，仍更像工程兼容。

### 3. Markdown uses its own workspace view model

Markdown 在编辑器壳层中使用自己的视图切换路径：至少包含“编辑视图”和“预览视图”。CSV 继续走表格视图，MML 继续走文本/表格 + 配置入口，普通文本继续走简单文本编辑。Markdown 主工具栏中的保存状态和保存按钮排列应保持与当前文本文件一致，避免仅因文件类型变化而改变保存反馈位置。

这个决定把“文件模式”和“可用视图”绑定到更符合用户认知的产品模型上，避免把 Markdown 塞进现有的“文本视图 / 表格视图”框架。

**Alternatives considered**
- 让 Markdown 继续使用当前通用文本工具栏：改动小，但会让预览入口和 MML 入口共存，主工具栏心智混乱。
- 为 Markdown 设计完全独立的工具栏布局：可强化文档感，但会打破当前文本文件工作区的一致性。

### 4. MML parsing entry remains limited to supported plain text files

MML 解析入口继续只面向支持的纯文本文件，Markdown 文件不得显示 `按 MML 解析` 入口。实现上应以文件模式或原始扩展名约束 MML 入口，而不是继续把所有 `text` 类内容都视为潜在 MML 载体。

这项决定主要是为了防止引入 Markdown 后，现有工作区错误地把 `.md` 暴露成“可按 MML 解析”的文件。

## Risks / Trade-offs

- [Markdown renderer dependency] → 需要引入新的前端依赖与安全清洗策略；通过选择成熟渲染库并默认禁用或清洗原始 HTML 降低风险。
- [Toolbar complexity growth] → Markdown 增加编辑/预览切换后，工作区主工具栏的模式分支会更多；通过按文件模式裁剪操作集合保持单个文件类型的主工具栏简洁。
- [Mode detection ambiguity] → `.md` 与 `mml`、`text` 的边界必须清晰；通过扩展名优先识别 Markdown，再由 MML 头部只作用于支持的纯文本文件来避免冲突。

## Migration Plan

1. 更新运行时上传白名单与文件模式识别，使新上传和已存在的 `.md` 工作区文件都能返回 `markdown` 模式。
2. 更新前端工作区文件类型契约与编辑器壳层，为 `markdown` 模式提供编辑/预览路径。
3. 通过工作区相关测试覆盖 `.md` 上传、打开、保存、预览切换以及现有 artifact 打开路径不回归。

回滚策略：
- 若前端预览能力出现风险，可保留 `.md` 上传与编辑支持，同时临时隐藏 Markdown 预览入口。
- 若整项变更需要整体回退，则 `.md` 文件仍保留在工作区存储中，但旧版本将无法以独立 Markdown 模式打开它们。

## Open Questions

- 预览实现是否只支持 `.md`，还是同时接受 `.markdown` 扩展名；本次 proposal 先按 `.md` 收敛。
- Markdown 预览是否允许有限 HTML；本次设计倾向于默认不信任原始 HTML。
