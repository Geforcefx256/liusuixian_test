## Why

当前工作台把文件进入工作区的主动入口拆散在两个位置：对话框里是显式 `上传文件` 按钮，工作区侧栏里是同时承载上传和空白文件创建的 `新增` 菜单。这让同一类用户心智在“给当前对话附加资料”与“管理工作区文件”之间摇摆，按钮语义也不一致。与此同时，工作区分组仍显示为 `input` / `output`，对用户来说过于工程化，无法直接表达“模型会读取的资料”和“模型生成的结果”这两个真实角色。

现在正好适合收敛这套交互：把文件进入系统的主入口统一到对话框附件流，移除低价值且分散注意力的空白文件新建能力，让右侧工作区退回为一个结果可见、可打开、可管理的文件侧栏。

## What Changes

- 将首页和会话页的对话框文件入口统一为极简 `+` 附件按钮，点击后直接打开受限文件选择器，而不是继续显示文字型 `上传文件` 按钮。
- 在对话框区域新增拖拽上传交互，支持一次拖入多个文件；拖拽高亮仅覆盖对话框外壳，不扩展到整页。
- 保留并强调当前上传文件类型治理：前端选择器与拖拽校验、后端上传校验继续共同限制为 `TXT / MD / CSV`。
- **BREAKING** 删除工作区右侧原有 `新增` 入口，不再在工作区侧栏提供上传入口或任何空白文件新建入口。
- **BREAKING** 下线空白文件新建能力，删除前端 create-file 流程、运行时 create-empty-file API，以及相关默认文件蓝图和测试覆盖。
- 将工作区文件分组从工程化的 `input` / `output` 用户可见文案收敛为 `参考资料` / `生成结果`，明确表达模型读取资料与模型产出结果的区别。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 调整对话框附件入口、拖拽上传交互、工作区文件入口结构，以及工作区文件分组命名。
- `agent-backend-runtime`: 移除空白文件新建 contract，并保持受限上传与工作区元数据分组语义与新前端模型一致。

## Impact

- Affected frontend code in `apps/web`, especially `ConversationPane`, `HomeStage`, `WorkbenchShell`, `WorkspaceSidebar`, `workbenchStore`, related API types, and focused workbench tests.
- Affected backend code in `apps/agent-backend`, especially workspace file routes, blank-file creation helpers, runtime workspace metadata shaping, and related tests.
- Affected OpenSpec requirements in `openspec/specs/agent-web-workbench/spec.md` and `openspec/specs/agent-backend-runtime/spec.md`.
- No top-level directory restructuring and no third-party dependency changes are intended in this change.
