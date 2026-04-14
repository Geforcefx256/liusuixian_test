## Why

当前工作区把上传文件建模为只读 `参考资料`，把可写文件建模为 `生成结果`，并且右侧文件区仍然是分组内平铺列表。这和现在明确的产品方向不一致：用户希望把上传进来的输入材料作为可持续整理和修订的工作输入，同时希望把 `working` 区当作真正的树状工作目录，在右侧直接新建文件夹与空白文档。

现在需要统一工作区心智，把“上传入口”和“新建入口”彻底分开：对话框 `+` 继续作为唯一上传入口，而右侧工作区恢复专用 `NEW` 入口，用于在 `working` 中新建文件夹、TXT、MD、MML，并让 `input` 与 `working` 都支持树状浏览和文件打开。

## What Changes

- **BREAKING** 将工作区用户可见分组从 `参考资料` / `生成结果` 改为 `input` / `working`。
- **BREAKING** 上传文件不再被建模为只读参考资料；`input` 中的上传文件改为可打开、可编辑、可保存，并在保存后仍保留在 `input`。
- **BREAKING** 工作区右侧不再是分组内平铺文件列表；`input` 与 `working` 在存在层级路径时都必须以前端树状结构展示。
- 允许上传入口保留输入材料的相对路径，使 `input` 可以承载文件夹层级并打开文件夹内文件。
- 在右侧工作区增加专用 `NEW` 入口，但该入口仅作用于 `working`。
- `NEW` 支持在 `working` 中新建文件夹、空白 `TXT`、空白 `MD`、空白 `MML`。
- `working` 支持文件夹重命名；本次不引入拖拽移动、跨文件夹移动文件或批量操作。
- 工作区编辑改为首版自动保存：在编辑器失焦、切换文件前、关闭文件前自动保存，而不是要求用户手动点击保存。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: 修改工作区分组文案、树状展示、上传文件可编辑语义、`NEW` 新建入口、文件夹重命名与自动保存交互要求。
- `agent-backend-runtime`: 修改工作区元数据分组与层级契约、上传相对路径保留、上传文件可写保存、`working` 新建文件/文件夹与文件夹重命名 contract。

## Impact

- Affected frontend code in `apps/web`, especially `WorkspaceSidebar`, workbench store, workspace editor pane, conversation upload flow, workspace API types, and focused workbench tests.
- Affected backend code in `apps/agent-backend`, especially workspace metadata shaping, upload persistence, file open/save routes, workspace file/folder creation and rename contracts, and related tests.
- Affected OpenSpec requirements in `openspec/specs/agent-web-workbench/spec.md` and `openspec/specs/agent-backend-runtime/spec.md`.
- No top-level directory restructuring and no third-party dependency changes are intended in this change.
