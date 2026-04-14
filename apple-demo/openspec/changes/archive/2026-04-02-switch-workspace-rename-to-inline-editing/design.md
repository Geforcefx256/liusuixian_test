## Context

当前工作区文件重命名能力已经存在，后端 `PATCH /files/:fileKey/rename` 和前端 stem-only 语义也已经稳定，但输入方式仍由 `workbenchStore` 内的 `window.prompt` 驱动。这个实现把瞬时 UI 交互状态放进了 store 的执行路径里，导致文件树无法体现“当前行进入编辑态”的反馈，也不利于补充键盘和 focus 行为。

这次变更只覆盖 `apps/web`，不修改后端 rename contract，也不扩大 rename 能力边界。关键约束保持不变：
- 重命名入口仍来自 Sidebar 行级菜单
- 有扩展名时只允许编辑 basename
- 当前会话运行中或目标文件存在未保存修改时，仍然禁止 rename
- rename 成功后继续保留当前文件的稳定 identity，并原地更新 sidebar 与 editor metadata

## Goals / Non-Goals

**Goals:**
- 让工作区文件重命名在当前文件行内完成，而不是依赖浏览器弹窗。
- 只替换文件名文本区域为输入态，保留整行既有的选中、高亮、双击打开和操作菜单布局。
- 为行内编辑补充清晰且可测试的提交语义：`Enter` 提交、`Esc` 取消、`blur` 自动提交、未改名则直接退出。
- 将瞬时编辑态留在 Sidebar 组件层，把 store 收敛为纯执行与状态同步职责。

**Non-Goals:**
- 不修改后端 rename API、`fileStore` 规则或 legacy output 边界。
- 不新增批量重命名、扩展名编辑、目录移动、撤销重命名或冲突自动改名能力。
- 不重做 Sidebar 行级动作菜单结构，也不把整行改造成通用可编辑列表项。

## Decisions

### Decision: 行内编辑状态放在 Sidebar，而不是继续放在 store

`editingFileId`、当前输入草稿、focus/selection 等瞬时 UI 状态由 `WorkspaceSidebar` 持有；store 只暴露“开始前校验是否允许重命名”和“提交完整文件名执行 rename”能力。

Rationale:
- 行内编辑是纯视图状态，放在组件层更符合单向数据流，也能避免 store 再次耦合具体输入形式。
- 这样可以让 `window.prompt` 彻底退出 rename 主路径，测试也更贴近真实 DOM 交互。

Alternatives considered:
- 继续由 store 维护编辑态：会让业务 store 持有过多瞬时 UI 细节，职责继续混杂。
- 新建独立 rename composable：当前交互范围只在 Sidebar，额外抽象会增加分散度。

### Decision: 只替换文件名文本片段为 input，扩展名保持只读展示

对于有扩展名的文件，行内编辑只把 basename 替换为输入框，扩展名仍以静态文本展示；无扩展名文件则整段名称为输入框。

Rationale:
- 这与现有 stem-only rename contract 完全一致，不会让用户误以为扩展名或目录也可编辑。
- 只替换文件名文本片段可以最大限度保留行级命中区、active/selected 样式和右侧菜单布局，减少交互冲突。

Alternatives considered:
- 整行切成单个 input：会挤占菜单区域，并干扰当前单击/双击行为。
- 继续展示完整文件名供用户编辑：会重新引入“后缀看起来可改”的错误预期。

### Decision: 失焦自动提交，而不是失焦取消

行内 rename 采用桌面文件树式结束语义：`Enter` 提交、`Esc` 取消、`blur` 自动提交。若输入值与原 stem 相同，则退出编辑态且不发请求。

Rationale:
- 对文件树行内改名来说，用户通常把“点到别处”理解成“结束本次改名”，自动提交比自动取消更符合本地文件管理器和 IDE 的心智模型。
- `Esc` 已经提供了显式取消路径，因此 blur 没必要再承担取消语义。
- 未改名时跳过请求，可以避免无意义的状态刷新和重复成功提示。

Alternatives considered:
- 失焦取消：更容易造成“已经改了却没有生效”的困惑，尤其是在高频轻操作场景里。
- 只允许 Enter 提交：对鼠标主导的文件树操作来说过于苛刻，也不符合常见桌面模式。

### Decision: store 对外暴露显式 rename 执行入口，保留原有阻断与收敛逻辑

store 需要把“收集输入”与“执行 rename”拆开，保留现有运行中/脏文件阻断、状态提示、成功后 metadata 收敛、失败时保留当前视图状态等逻辑；Sidebar 在提交时直接传入完整文件名。

Rationale:
- rename 的风险控制和状态收敛已经在 store 内稳定存在，不应因 UI 形态变化而下沉到组件里。
- 组件只负责把 stem 与扩展名重组成完整文件名，再调用 store 执行，可保持前后端 contract 不变。

Alternatives considered:
- 由 Sidebar 直接调 API：会绕过现有 store 的阻断与状态同步路径，破坏当前状态模型。
- 保留原 `renameWorkspaceFile(fileId)` 并内部兼容 prompt / inline 两种输入源：会留下无必要的兼容分支。

## Risks / Trade-offs

- [Blur 与行级菜单/选择行为可能互相影响] → 仅让文件名文本区进入编辑态，并在提交中明确控制焦点切换与事件传播。
- [异步提交期间重复触发 Enter/blur 可能造成双发请求] → 提交中禁用再次提交，并在组件层锁住当前编辑态直到请求完成。
- [store 与 Sidebar 的职责切分不清会让测试变脆] → 用组件测试覆盖 DOM 交互，用 store 测试覆盖阻断、成功和失败状态，避免互相重叠。
- [失焦自动提交对非法输入更敏感] → 非法输入必须显式保留在编辑态并向用户暴露错误，而不是静默取消。

## Migration Plan

1. 先拆分 store 的 rename 执行入口，去掉 `window.prompt` 依赖但保留现有阻断与收敛逻辑。
2. 在 Sidebar 中加入行内编辑态和 basename/extension 组合渲染。
3. 补齐键盘、失焦、失败态与无变化提交的组件/store 测试。
4. 本次变更不涉及后端迁移，也不要求调整现有 workspace 数据。

## Open Questions

- None.
