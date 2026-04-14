## Why

Node.js v24 在 Windows 上对 `--import` 参数引入了更严格的 ESM URL 解析：原始 Windows 路径（如 `D:\path\loader.mjs`）会被拒绝，Node.js 会把盘符 `D:` 误认为 URL 协议，抛出 `ERR_UNSUPPORTED_ESM_URL_SCHEME`。当前 `scriptExecutor.ts` 的 `resolveTsxLoaderPath()` 直接返回原始文件系统路径，导致所有 skill 脚本在 Windows + Node.js v24 环境下完全无法执行。

## What Changes

- 将 `resolveTsxLoaderPath()` 的返回值从原始文件系统路径改为 `file://` URL 格式（使用 `node:url` 的 `pathToFileURL()`）
- 新增 `import { pathToFileURL } from 'node:url'` 导入

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `governed-skill-script-execution`: 修复 `--import` 参数在 Windows + Node.js v24 下的路径兼容性问题，确保 tsx loader 路径始终以 `file://` URL 格式传递

## Impact

- **代码**: `apps/agent-backend/src/runtime/tools/skill/scriptExecutor.ts`（1 个 import + 1 行 return 语句）
- **运行时**: 所有平台的 Node.js `--import` 调用从原始路径变为 `file://` URL（macOS/Linux/Windows 均兼容，`pathToFileURL()` 在所有平台上正确工作）
- **依赖**: 无新增第三方依赖（仅使用 Node.js 内置模块 `node:url`）
