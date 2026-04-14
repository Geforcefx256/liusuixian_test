## Context

`local:grep` 工具底层调用 vendored ripgrep 执行文件内容搜索，核心调用链为：

```
grepWorkspaceFiles()           // grep.ts:54
  → resolveRipgrepSelection()  // 选择平台对应的 rg 二进制
  → assertRipgrepBinaryAccessible()
  → readRipgrepVersion()       // spawn rg --version (5s timeout)
  → executeRipgrep()           // spawn rg --json ... (30s timeout)
  → buildSnippets()            // grepPayload.ts:21 — 对每个 match 读文件构建 snippet
  → buildSearchPayload()       // 序列化最终 JSON 输出
```

本次优化针对两个已确认的性能热点，均为纯内部重构，不改变 grep 的输入参数、输出格式或错误行为。

## Goals / Non-Goals

**Goals:**

- 消除每次 grep 调用中冗余的 `rg --version` spawn，改为进程级缓存。
- 消除 `buildSnippets` 中同文件的重复 `fs.readFile`，改为按文件分组后单次读取。
- 保持 `grepWorkspaceFiles` 的函数签名、返回格式和错误语义完全不变。
- 保持现有测试全部通过，并补充针对新行为的测试用例。

**Non-Goals:**

- 不在本次变更中引入 `--max-count`、rg 原生 context、multiline 等新能力（属于后续 Phase 2/3）。
- 不改变 `LocalGrepArgs` 接口或 `grepInputSchema`。
- 不改变 `LocalGrepOptions` 的公开接口。
- 不改变 ripgrep 二进制选择或 `commandRunner` 的行为。

## Decisions

### 1. ripgrep version 使用模块级 Map 缓存，key 为 binaryPath

在 `grep.ts` 中引入一个模块级 `Map<string, string>` 作为 version 缓存。`readRipgrepVersion`（或包装函数）在首次调用时 spawn `rg --version` 并将结果存入 cache，后续调用直接返回缓存值。

选择 `binaryPath` 作为 key，因为不同平台/架构对应不同的 vendored 二进制，key 必须能区分它们。在实际运行中，同一进程生命周期内 binaryPath 是固定的，所以 cache 基本只有一个条目。

备选方案：

- 在 `LocalToolProvider` 构造时一次性执行 version check 并注入：会改变 `LocalGrepOptions` 接口和 provider 初始化流程，变更面更大。
- 使用 `LocalGrepOptions` 上的可选 `cachedVersion` 字段由调用方管理：将缓存职责推给上层，不符合单一职责。

### 2. buildSnippets 按文件路径分组，每个文件只读一次

将 `buildSnippets`（`grepPayload.ts:21`）的实现改为：先按 `match.path` 分组，对每组只调用一次 `fs.readFile` 获取文件内容和行数组，然后该组的所有匹配共享同一份行数据调用 `formatSnippet`。

当前实现是 `Promise.all(matches.map(match => buildSnippet(...)))`，每个 match 独立读文件。改为分组后，需要保持最终 `SearchMatch[]` 的顺序与输入 `RgMatch[]` 的顺序一致（按 ripgrep 的输出顺序），以避免改变输出行为。

实现方式：

- 引入 `readFileLines(absolutePath): Promise<string[]>` 纯 IO 函数，负责读取和分行。
- `buildSnippets` 内部用 `Map<relativePath, string[]>` 缓存已读文件的行数据。
- 遍历 matches 时，若 cache 中已有该文件则直接复用，否则读取后存入 cache。
- `formatSnippet` 保持为纯计算函数，接受行数组、行号、context，返回格式化字符串。

备选方案：

- 使用 LRU cache 限制内存：匹配数上限 200，文件数不会太多，简单 Map 即可。
- 先 `groupBy` 再并发读取每组的文件：可以做，但当前 `Promise.all` 顺序语义需要额外处理。保持顺序遍历 + lazy cache 更简单且不改变行为。

### 3. 日志和 trace 行为保持不变

version cache 命中时仍然调用 `logRipgrepSelection` 记录 selection 和 version 信息。日志内容不应因缓存而丢失——调用方仍需要知道当前使用的 ripgrep 版本和目标平台。不新增 cache hit/miss 日志（避免日志膨胀），但可在 trace data 中附加 `versionCached: boolean` 字段用于调试。

## Risks / Trade-offs

- [Risk] version cache 在 vendored 二进制被热替换时可能返回旧版本。
  - Mitigation: vendored 二进制在运行时不会被替换。如果二进制更新，必然伴随后端重启，cache 自然失效。

- [Risk] buildSnippets 分组实现中文件读取失败可能影响同文件其他匹配的 snippet。
  - Mitigation: 保持现有错误传播行为——任一文件读取失败则整个 `buildSnippets` 抛出，与当前行为一致。

- [Trade-off] 分组后所有文件内容在 `buildSnippets` 执行期间驻留内存，理论上比逐个读取的峰值内存略高。
  - 评估: 匹配上限 200，涉及文件通常不超过几十个，单文件内容在 KB 级别，总量可忽略。

## Open Questions

(none)
