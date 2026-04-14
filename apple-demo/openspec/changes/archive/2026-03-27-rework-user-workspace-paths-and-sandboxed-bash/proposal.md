## Why

当前工作区文件流把 `fileKey` 与 `@file:<fileKey>` 暴露给 LLM，并让本地文件工具继续面向产品仓库根目录。这导致模型文件心智与真实用户工作区边界脱节，也让 `read` / `write` / `run_command` 无法在安全上被严格约束到当前 `user + agent` 工作区。

现在需要把文件协议收敛为“路径优先、按需读取、上传原件只读、执行受沙箱约束”的一致模型，否则后续继续扩展 skill、文件编辑和命令执行时，错误边界会越来越深地固化进提示词、技能和运行时工具中。

## What Changes

- 将工作区文件协议改为 path-first：LLM 只面向当前用户工作区中的相对路径工作，不再依赖 `fileKey` 或 `@file:<fileKey>` 作为模型侧文件寻址协议。
- 调整本地文件工具合同：未知路径时优先 `find_files`，只有在明确需要文件内容时才使用 `read_file`。
- **BREAKING** 将 `read_file`、`find_files`、`list_directory`、`write`、`bash` 的有效工作区边界从产品仓库根切换到当前 `user + agent` scoped workspace。
- 将上传文件改为保留原始文件名的工作区输入资产，并定义同名上传必须先确认再覆盖。
- 将 `uploads/` 定义为只读输入区，工作区编辑器允许打开查看上传文件，但不允许保存回上传原件。
- 将工作区输出分离为可写输出区域与中间产物区域，要求运行时写入与命令执行产物都落在当前用户工作区内。
- **BREAKING** 将 `bash` 从普通宿主进程执行模型升级为受限沙箱执行模型，约束可见目录、写入范围、网络访问和资源使用。
- 更新 workspace-agent 提示词、文件上下文提示与相关 skills，使其遵守“先找路径，再按需读取”的新文件使用规则，并移除对旧 `@file` 句柄协议的依赖。

## Capabilities

### New Capabilities
- `sandboxed-workspace-command-execution`: 定义面向当前 `user + agent` 工作区的受限命令执行合同，包括只读 runtime、只读 uploads、可写 outputs/temp、禁网和资源限制。

### Modified Capabilities
- `agent-backend-runtime`: 调整工作区文件寻址、上传命名、上传覆盖、上传只读、工具边界和运行时命令执行行为。
- `agent-web-workbench`: 调整工作区文件上下文与编辑器行为，使上传文件只读、上传覆盖需要确认，并让后续 Agent 文件上下文遵循路径优先模型。

## Impact

- Affected backend code in `apps/agent-backend`, especially workspace file storage, file open/save routes, local tool providers, prompt assembly, skill/runtime contracts, and command execution.
- Affected frontend code in `apps/web`, especially upload flow, overwrite confirmation, workspace editor save affordances, and follow-up Agent invocation context.
- Affected governed skills and runtime assets that currently depend on `invocationContext.fileAssets.fileKey` or `@file:<fileKey>`.
- Likely adds a sandbox execution dependency or runtime integration layer for command isolation.
