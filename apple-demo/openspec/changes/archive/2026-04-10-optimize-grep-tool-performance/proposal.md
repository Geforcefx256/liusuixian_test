## Why

`apps/agent-backend` 的 `local:grep` 工具在每次调用中存在两处可消除的性能浪费：

1. **冗余 version check**：每次 grep 调用都 spawn 一次 `rg --version`（5s 超时），而 vendored ripgrep 的版本在进程生命周期内不会变化。在高频搜索场景（agent 连续多轮使用 grep 定位代码），每次调用都多出一次不必要的进程创建和 5s 超时窗口。

2. **snippet 同文件重复读取**：`buildSnippets` 对每个匹配都通过 `fs.readFile` 整文件读取再 `split('\n')` 提取上下文行。如果一个文件中有 N 个匹配，该文件会被完整读取 N 次。在搜索常见 pattern 时（如 `import`、`logger`），同一文件通常包含多个匹配，导致显著的重复 IO。

这两个问题独立且修复风险低，不涉及外部契约变更，适合作为第一阶段优化先行落地。

## What Changes

- 在 grep 执行链路中缓存 ripgrep version 检查结果，同一 `binaryPath` 只 spawn 一次 `rg --version`，后续调用直接复用缓存值。
- 重构 `buildSnippets` 的文件读取逻辑，按匹配文件路径分组后每个文件仅读取一次，所有匹配共享同一份行数据构建 snippet。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agent-backend-runtime`: grep 工具的内部执行效率优化。不改变输入 schema、输出格式或对外行为。

## Impact

- Affected code:
  - `apps/agent-backend/src/runtime/tools/local/grep.ts` — version check 缓存
  - `apps/agent-backend/src/runtime/tools/local/grepPayload.ts` — snippet 文件读取去重
  - `apps/agent-backend/src/runtime/tools/local/grep.test.ts` — 补充缓存和去重验证
- APIs and contracts:
  - `local:grep` 的输入 schema 和输出 JSON 格式不变
  - `GatewayInvokeResponse` 结构不变
- Systems:
  - 仅影响 `agent-backend` 内部运行时，不影响 `web`、`web-backend` 或外部协议
