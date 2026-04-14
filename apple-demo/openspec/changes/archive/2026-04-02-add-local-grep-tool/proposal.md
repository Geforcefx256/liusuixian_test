## Why

`apps/agent-backend` 目前只有 `local:search_in_files`，能力模型、参数语义和参考实现中的 `GrepTool` 不一致，而且运行依赖宿主机 `rg` 的方式不适合后续 Linux/Windows 部署。需要把内容搜索能力统一为 `local:grep`，并把 `ripgrep` 作为运行时内置资产纳入发布产物和日志诊断链路。

## What Changes

- 将本地内容搜索工具统一为 `local:grep`，替代 `local:search_in_files`。
- 为执行器 agent 提供默认开放的 `local:grep`，暂不向 planner 暴露。
- 将内置 `ripgrep` 固定为 `15.1.0`，随 `apps/agent-backend` 一起打包发布。
- 为 Linux、Windows 和 macOS 目标平台 vendoring 对应 `rg` 二进制，并在运行时按平台、架构和 Linux libc 精确选择。
- 将 `local:grep` 的搜索范围限制在当前工作区内，不允许越界到工作区外。
- 为 `local:grep` 增加显式的初始化日志、执行日志和错误日志，严格区分“无匹配结果”和“工具执行失败”。
- **BREAKING** 删除 `local:search_in_files` 的工具暴露与相关配置入口，统一收敛到 `local:grep`。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 调整本地工具运行时能力，新增 vendored `ripgrep` 选择与日志要求，并将工作区内容搜索统一为 `local:grep`。

## Impact

- Affected code: `apps/agent-backend/src/runtime/tools/**`, `apps/agent-backend/src/memory/**`, `apps/agent-backend/scripts/**`, `apps/agent-backend/assets/**`
- Affected runtime behavior: 本地工具清单、执行器可用工具、workspace 搜索边界、运行日志与错误暴露
- Affected build/release: `apps/agent-backend` dist 资产需包含 vendored `ripgrep`
- Dependencies: 确认并固定内置 `ripgrep` 版本为 `15.1.0`
