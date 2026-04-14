## 1. Cache Ripgrep Version Check

- [x] 1.1 在 `apps/agent-backend/src/runtime/tools/local/grep.ts` 中引入模块级 `Map<string, string>` 缓存，将 `readRipgrepVersion` 改为先查 cache、miss 时 spawn 并存入 cache 的逻辑。保持函数签名和错误行为不变。
- [x] 1.2 在 `logRipgrepSelection` 的 trace data 中附加 `versionCached: boolean` 字段，便于运行时调试。
- [x] 1.3 在 `apps/agent-backend/src/runtime/tools/local/grep.test.ts` 中补充测试：验证同一 `binaryPath` 的第二次 `grepWorkspaceFiles` 调用不再 spawn `rg --version`（通过 mock CommandRunner 的调用计数断言）。

## 2. Deduplicate File Reads In Snippet Building

- [x] 2.1 在 `apps/agent-backend/src/runtime/tools/local/grepPayload.ts` 中提取 `readFileLines(absolutePath): Promise<string[]>` 纯 IO 函数，将文件读取和分行职责从 `buildSnippet` 中分离。
- [x] 2.2 重构 `buildSnippets` 实现：使用 `Map<string, string[]>` 作为文件行缓存，遍历 matches 时 lazy 读取每个文件（首次 miss 读取，后续 hit 复用），保持最终 `SearchMatch[]` 顺序与输入 `RgMatch[]` 一致。
- [x] 2.3 在 `apps/agent-backend/src/runtime/tools/local/grep.test.ts` 中补充测试：构造同一文件多个匹配的场景，验证输出 snippet 正确且文件只被读取一次（可通过 spy `fs.readFile` 的调用次数断言）。

## 3. Verification

- [x] 3.1 执行 `pnpm test` 确认所有现有测试通过，无回归。
- [x] 3.2 执行 `pnpm type-check` 确认无类型错误。
