## Why

agent-backend 的 local 工具集目前只有 `write`（整文件创建）和 `read_file`（读取），缺少原地编辑能力。LLM 生成文件后若需局部修改，只能用 `write` 整文件覆写，既浪费 token 也容易引入错误。新增 `local:edit` 工具可实现精确的字符串替换，参考 Claude Code 的 Edit 工具设计。

## What Changes

- 新增 `local:edit` 工具，支持对 `outputs/` 目录下的文件进行精确字符串替换（`old_string` → `new_string`）
- 支持 `replace_all` 参数，默认 `false`（要求唯一匹配，防止误改）
- 引入 session 级 `ReadFileStateMap`，在 `read_file` 时记录文件时间戳，`edit` 时做 staleness check 防止编辑过时内容
- 修改 `read_file` 返回类型以携带文件元数据（`mtimeMs`）
- 从 `writeFile.ts` 导出 `normalizeOutputRelativePath` 供 `editFile.ts` 复用

## Capabilities

### New Capabilities

- `file-edit`: 对 workspace outputs 目录下已有文件的精确字符串替换编辑能力

### Modified Capabilities

- `file-read`: 扩展 `readWorkspacePath` 返回值，新增 `fileMeta`（absolutePath, relativePath, mtimeMs），用于支持 edit 工具的 staleness check

## Impact

- **代码变更**：`apps/agent-backend/src/runtime/tools/` 目录下新增 2 个文件，修改 4 个文件
- **API 变更**：`readWorkspacePath()` 返回类型从 `string` 变为 `ReadFileResult`，所有调用方需适配
- **工具注册**：`localProvider` 新增 `edit` 工具的 manifest 和路由
- **依赖**：v1 不引入新依赖
