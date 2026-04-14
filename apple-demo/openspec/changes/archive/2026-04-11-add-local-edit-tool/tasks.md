## 1. 基础设施

- [x] 1.1 新建 `apps/agent-backend/src/runtime/tools/local/readFileState.ts`：实现 `ReadFileStateEntry` 接口和 `ReadFileStateMap` 类（record / get / clearSession）
- [x] 1.2 在 `apps/agent-backend/src/runtime/tools/local/schemas.ts` 新增 `editFileInputSchema`（file_path, old_string, new_string, replace_all）
- [x] 1.3 在 `apps/agent-backend/src/runtime/tools/local/writeFile.ts` 中将 `normalizeOutputRelativePath` 和 `WINDOWS_ABSOLUTE_PATH_PATTERN` 改为导出

## 2. readFile 改造

- [x] 2.1 修改 `apps/agent-backend/src/runtime/tools/local/readFile.ts`：新增 `ReadFileResult` 接口，`readWorkspacePath` 返回类型从 `string` 改为 `ReadFileResult`，携带 `fileMeta`（absolutePath, relativePath, mtimeMs）

## 3. editFile 核心实现

- [x] 3.1 新建 `apps/agent-backend/src/runtime/tools/local/editFile.ts`：实现 `editWorkspaceOutput` 函数，包含路径校验、文件读取、staleness check、唯一性校验、字符串替换、写回、状态更新

## 4. localProvider 集成

- [x] 4.1 在 `apps/agent-backend/src/runtime/tools/providers/localProvider.ts` 中注册 edit 工具 manifest（id: 'edit', MUTATING_LOCAL_TOOL_POLICY）
- [x] 4.2 在 `invoke()` 方法中新增 `edit` 路由分支和 `invokeEdit()` 方法
- [x] 4.3 修改 `invokeReadFile()` 方法：解构 `ReadFileResult`，调用 `readFileState.record()` 记录文件元数据
- [x] 4.4 修改 `sanitizeLogArgs()` 为 edit 工具脱敏 old_string/new_string
- [x] 4.5 修改 `buildSuccessLogPayload()` 使 edit 工具走 logMeta 路径

## 5. 验证

- [x] 5.1 运行 `pnpm type-check` 确保类型安全
- [x] 5.2 运行 `pnpm test` 确保现有测试通过（如 catalog 断言需更新则一并修改）
