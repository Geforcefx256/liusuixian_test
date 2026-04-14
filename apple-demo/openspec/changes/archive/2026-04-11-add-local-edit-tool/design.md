## Context

agent-backend 的 `localProvider` 提供 6 个工具（read_file, list_directory, find_files, grep, write, question）。其中 `write` 只能创建/覆写文件，`read_file` 只能读取文件，缺少原地编辑能力。

现有架构：
- 工具注册在 `localProvider.ts` 的 `this.tools` 数组，通过 `invoke()` 方法的 if-chain 路由
- 文件写入通过 `fileStore` 限定在 `outputs/` 目录
- 每个工具返回 `{ summary: string, logMeta?: Record<string, unknown> }`

## Goals / Non-Goals

**Goals:**
- 新增 `local:edit` 工具，支持精确字符串替换
- 仅允许编辑 `outputs/` 目录下的文件（agent 自己生成的）
- 引入轻量的 staleness check 防止编辑过时内容
- 复用现有路径校验和 fileStore 机制

**Non-Goals:**
- 不支持正则替换（仅精确字符串匹配）
- 不支持编辑 `uploads/` 目录（用户上传的文件）
- 不引入文件锁机制
- v1 不引入 `diff` 依赖
- 不支持创建新文件（用 `write` 工具）

## Decisions

### 1. 路径限制复用 writeFile 的 normalizeOutputRelativePath

**选择**：从 `writeFile.ts` 导出 `normalizeOutputRelativePath`，在 `editFile.ts` 中复用。

**替代方案**：在 editFile.ts 中重写一份路径校验逻辑。

**理由**：edit 和 write 的路径安全要求完全一致（都限定在 outputs/ 目录），复用可避免逻辑分叉。函数仅 18 行，改为导出不影响现有行为。

### 2. 用内存 Map 实现 ReadFileStateMap，不用 sessionStore

**选择**：`Map<sessionKey, Map<absolutePath, { mtimeMs, ... }>>` 纯内存结构。

**替代方案**：使用 SQLite 支撑的 `sessionStore` 持久化。

**理由**：readFileState 是短暂的运行时状态，不需要持久化，不需要跨进程共享。使用 sessionStore 会引入不必要的 DB 开销。服务重启后状态丢失是可接受的（LLM 需要重新 read 文件）。

### 3. readWorkspacePath 返回类型改为 ReadFileResult

**选择**：`{ summary: string, fileMeta?: { absolutePath, relativePath, mtimeMs } }`。

**替代方案**：通过回调或事件通知 localProvider 记录状态。

**理由**：`fs.stat()` 已在 readFile 流程中被调用（用于判断是否为目录），`stats.mtimeMs` 可零成本获取。改返回类型比引入回调更直接，且只有一个调用方（localProvider.ts）需要适配。

### 4. 字符串替换用 split().join() 而非正则

**选择**：`replace_all` 时使用 `content.split(old_string).join(new_string)`。

**替代方案**：`String.replaceAll()` 或正则 `new RegExp(escaped, 'g')`。

**理由**：`split().join()` 对 old_string 中的正则特殊字符天然安全，无需转义。`String.replaceAll()` 也可以，但 `split().join()` 在各 Node 版本行为一致。

### 5. edit 后更新 readFileState

**选择**：edit 成功后重新 `stat()` 并更新 readFileState 中的 mtime 记录。

**理由**：允许连续 edit 同一文件（edit → edit）而不触发 staleness 告警。如果不更新，第二次 edit 会因为第一次 edit 改变了文件 mtime 而报错。

## Risks / Trade-offs

- **[mtime 精度]** 文件系统时间戳精度因平台而异（ext4 为 1ns，HFS+ 为 1s）。使用 1ms 容差做比较。→ 对 outputs/ 目录足够，极端情况下可能漏检同 ms 内的外部修改，可接受。
- **[内存泄漏]** ReadFileStateMap 按 sessionKey 积累，无清理机制。→ 每个 session 的条目数有限（仅记录读过的文件），且 session 数有限。可在后续按需加 TTL 或 session 结束清理。
- **[非原子操作]** read-modify-write 之间无文件锁，存在 TOCTOU 窗口。→ 与 Claude Code 同策略，通过 staleness check 做最佳努力检测，不追求强一致。RunCoordinator 已阻止同 session 并发 run。
