## Why

当前工作区文件重命名仍通过浏览器 `prompt` 收集输入，交互会把用户从文件树上下文里抽离，也无法呈现“当前这一行正在改名”的即时反馈。既然后端 rename contract 和前端 stem-only 语义已经稳定，现在需要把重命名体验收敛为文件行内编辑，让工作区行为更接近 IDE / 文件管理器的本地操作心智。

## What Changes

- 将工作区文件重命名从浏览器弹窗改为右侧 `工作空间` 文件行内编辑，仅替换文件名文本区域，不改动整行选择、双击打开和行级操作菜单的整体结构。
- 保留当前 stem-only rename 语义：有扩展名的文件只允许编辑 basename，并在行内只读展示原扩展名；无扩展名文件仍可编辑完整名称。
- 统一行内编辑提交语义：`Enter` 提交、`Esc` 取消、`blur` 自动提交；若名称未变化，则退出编辑态且不发起请求。
- 将前端重命名职责拆分为“Sidebar 持有临时编辑态”和“store 负责校验阻断、调用 rename API、收敛成功/失败状态”，移除对 `window.prompt` 的依赖。
- 更新相关 workbench 组件与 store 测试，覆盖行内编辑、键盘交互、失焦提交和失败态保留行为。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: workspace 文件重命名的交互从浏览器弹窗切换为文件行内编辑，并补充键盘与失焦提交语义。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/WorkspaceSidebar.vue`
  - `apps/web/src/components/workbench/WorkbenchShell.vue`
  - `apps/web/src/stores/workbenchStore.ts`
  - related frontend unit tests
- APIs:
  - 不修改现有 `/agent/api/files/:fileKey/rename` 契约，前端仍向后端提交完整文件名
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - 前端工作区文件树交互、rename 提交流程与现有 sidebar/editor 状态收敛逻辑
