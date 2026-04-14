## Context

`scriptExecutor.ts` 通过 `spawn('node', ['--import', loaderPath, entryPath, ...])` 执行 skill 脚本。当脚本入口为 `.ts` 文件时，使用 tsx 的 ESM loader 进行即时编译加载。

`resolveTsxLoaderPath()` 函数（第 71-78 行）通过 `resolveBackendRoot()` 获取后端根目录，拼接 tsx loader 的相对路径后直接返回原始文件系统路径字符串。这在 macOS/Linux 上正常工作，但在 Windows + Node.js v24 上，`--import` 参数经过 ESM URL 解析时会把盘符（如 `D:`）误认为 URL 协议，抛出 `ERR_UNSUPPORTED_ESM_URL_SCHEME`。

## Goals / Non-Goals

**Goals:**
- 修复 Windows + Node.js v24 下 skill 脚本执行失败的问题
- 保持所有现有平台（macOS/Linux）的行为不变
- 保持与 Node.js v22+ 的兼容性

**Non-Goals:**
- 不修改 `entryPath`（第 49 行）的传递方式——它是 Node 主模块参数，不受 ESM URL 解析影响
- 不重构路径拼接方式（如将模板字符串改为 `path.join()`）——这不影响功能
- 不引入新的第三方依赖

## Decisions

**Decision: 使用 `pathToFileURL()` 转换 `--import` 参数**

`pathToFileURL()` 是 Node.js 内置模块 `node:url` 的函数，将文件系统路径转换为标准 `file://` URL。选择此方案的理由：

- **Node.js 官方推荐方式**：`--import` 参数的文档明确指出应使用 URL 格式
- **跨平台兼容**：`pathToFileURL()` 在 macOS、Linux、Windows 上均正确处理路径编码（包括空格、特殊字符、UNC 路径）
- **向后兼容**：`file://` URL 在 Node.js v18+ 的 `--import` 中就被支持，不影响旧版本

**Alternatives considered:**
- 手动拼接 `file://` 前缀：容易出错（路径编码、UNC 路径、特殊字符处理不完整）
- 条件判断 `process.platform === 'win32'`：增加不必要的分支复杂度，`pathToFileURL()` 在所有平台上安全

## Risks / Trade-offs

- **[无功能风险]** `pathToFileURL()` 在所有平台上生成 `file://` URL，而 `--import` 在 Node.js v18+ 就接受此格式，macOS/Linux 上的行为不变
- **[无迁移需求]** 这是一个内部路径解析的 bug 修复，不影响任何外部 API 或配置格式
