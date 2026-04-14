## Why

`local:edit` 当前直接在磁盘原始文本上匹配 `old_string`，而 `read_file` 会先将 `\r\n` 和 `\r` 规范化为 `\n` 后再返回内容。这导致模型从 `read_file` 复制出的多行文本在 CRLF 文件中无法被 `edit` 匹配，破坏了“先读后改”的基本工作流。

## What Changes

- 统一 `read_file` 与 `local:edit` 的文本语义，明确两者都基于相同的换行规范化视图工作。
- 调整 `local:edit` 的匹配与替换逻辑，使从 `read_file` 复制的多行 `old_string` 可以在 CRLF 文件中可靠命中。
- 在写回文件时保留原文件的主换行风格，避免一次局部编辑意外重写整个文件的行尾格式。
- 为 CRLF、LF 与删除/替换场景补充回归测试，锁定工具契约。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 调整本地文件工具中 `read_file` 与 `edit` 的换行处理契约，确保读取视图与编辑匹配语义一致。

## Impact

- Affected code: `apps/agent-backend/src/runtime/tools/local/readFile.ts`, `apps/agent-backend/src/runtime/tools/local/editFile.ts`, `apps/agent-backend/src/runtime/tools/local/shared/textUtils.ts`, `apps/agent-backend/src/runtime/tools/providers/localProvider.test.ts`
- APIs: `local:edit` 与 `read_file` 的行为契约更明确，但无需新增入参
- Dependencies: none
- Systems: agent-backend local filesystem tool flow
