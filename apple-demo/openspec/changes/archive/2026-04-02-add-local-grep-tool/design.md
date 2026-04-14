## Context

`apps/agent-backend` 当前通过 `local:search_in_files` 提供内容搜索能力，工具命名与参考实现不一致，参数模型也没有对齐 `GrepTool` 的使用习惯。现有实现对 `rg` 的依赖是运行时发现式的，并保留 Node 回退路径，这与后续 Linux/Windows 交付目标、工作区边界约束以及仓库的 debug-first 原则不一致。

这次变更同时影响本地工具清单、执行链路、运行时资产、打包脚本、配置默认值和 devlog，因此需要在实现前把技术决策一次收敛。

## Goals / Non-Goals

**Goals:**
- 用 `local:grep` 统一执行器的内容搜索能力，并移除 `local:search_in_files`
- 将 `ripgrep 15.1.0` 作为 `apps/agent-backend` 的内置运行时资产随 dist 一起发布
- 支持 macOS 运行时通过 vendored `rg` 执行 `local:grep`
- 仅允许 `local:grep` 在当前工作区内搜索
- 在运行时精确选择 Linux/Windows/macOS 对应 `rg` 二进制，并在失败时显式报错
- 为 `local:grep` 提供初始化日志、执行日志和失败日志，便于部署和运行排障

**Non-Goals:**
- 不为 planner 暴露 `local:grep`
- 不保留 `search_in_files` 的兼容别名或静默回退行为
- 不在本次变更中引入系统 PATH `rg` 的 fallback

## Decisions

### 1. 用单一工具名 `local:grep` 替换 `local:search_in_files`

执行器只暴露 `local:grep`，并删除 `local:search_in_files` 的 manifest、配置文案、测试默认值和 shipped defaults。这样可以让工具命名、提示语义和后续参数设计统一到 grep 心智模型，避免同一能力长期保留两套入口。

备选方案：
- 保留 `search_in_files` 兼容别名。未采用，因为会增加提示词、配置、日志和测试矩阵复杂度。

### 2. vendored `ripgrep` 放在 `apps/agent-backend/assets/vendor/ripgrep/`

`build-agent-dist.mjs` 已经会把 `assets/**` 带入 dist，运行时也已有 `resolveAgentAssetsRoot(...)` 可同时覆盖源码模式与 dist 模式。将 `rg` 放在 `assets/vendor/ripgrep/<target>/` 可以复用现有资产分发路径，不需要引入新的根级目录或发布步骤。

目录约定：
- `x86_64-unknown-linux-gnu/rg`
- `x86_64-unknown-linux-musl/rg`
- `aarch64-unknown-linux-gnu/rg`
- `aarch64-unknown-linux-musl/rg`
- `x86_64-apple-darwin/rg`
- `aarch64-apple-darwin/rg`
- `x86_64-pc-windows-msvc/rg.exe`
- `aarch64-pc-windows-msvc/rg.exe`

备选方案：
- 放到 `dist/`。未采用，因为 dist 不是源码真相。
- 放到 `workspace/` 或 `data/`。未采用，因为这些目录属于运行时数据，不适合静态二进制资产。

### 3. 运行时按平台精确选择 vendored `rg`

Linux 下选择逻辑基于 `process.platform`、`process.arch` 和 `libc`，其中 `libc` 优先通过 `process.report.getReport().header.glibcVersionRuntime` 判定；有值视为 `glibc`，否则视为 `musl`。Windows 和 macOS 下仅根据 `process.arch` 选择。

运行时不允许 silent fallback 到系统 `rg` 或 Node 搜索实现。找不到对应二进制、无执行权限、启动失败、返回非预期退出码时，工具必须直接失败并输出诊断信息。

备选方案：
- fallback 到 PATH 里的 `rg`。未采用，因为部署结果不可预测，且会弱化版本和日志诊断的一致性。
- fallback 到 Node 文件遍历搜索。未采用，因为这会把“工具依赖坏了”伪装成“能力仍可用”，违反 debug-first 原则。

### 4. 将日志拆成“统一工具日志 + `rg` 专属诊断日志”两层

`localProvider` 保留统一的 `started/completed/failed` 工具调用日志；`local:grep` 实现文件单独记录 `component: local_grep` 的 `rg` 初始化与执行日志。这样既能保持全局工具日志一致性，也能把 `platform`、`arch`、`libc`、target triple、`rg` 路径、`--version`、exit code、signal、stderr、耗时、结果数等诊断字段沉到最接近故障源的位置。

日志结果语义固定为三类：
- 成功且有命中
- 成功但无命中
- 执行失败

### 5. 搜索范围只允许落在当前工作区内

`local:grep` 继续通过工作区根解析 `basePath`，所有搜索路径都必须经过 workspace-relative 约束和越界校验。工具不接受工作区外绝对路径，也不能通过路径上跳访问外部目录。这一限制既适配当前本地工具边界，也避免 vendored `rg` 被误用成宿主机全局搜索器。

## Risks / Trade-offs

- [运行时 target 判定错误] → 在首次选择 `rg` 时打印 `platform`、`arch`、`libc`、target triple 和 `rg --version`，便于部署时快速定位
- [vendored 二进制增大发布包] → 仅下载已确认需要的 Linux/Windows/macOS 目标，不引入额外 fallback 资产
- [删除旧工具名导致配置或测试失效] → 在同一变更中同步更新工具清单、默认 deny/allow、配置文案和测试
- [Windows 与 Linux 可执行文件差异] → 在路径解析层统一处理可执行文件名与目标目录，避免业务层分散判断

## Migration Plan

1. 新增 ripgrep 下载脚本，将 `15.1.0` 对应 Linux、Windows 和 macOS 目标下载到 `assets/vendor/ripgrep/`
2. 引入 `local:grep` 运行时实现与 vendored `rg` 解析逻辑
3. 替换 `localProvider`、配置解析、默认工具清单和测试中的 `search_in_files`
4. 删除旧工具入口与 Node fallback
5. 验证源码模式、dist 模式和日志文件中都能看到正确的 `local:grep` / `rg` 行为

## Open Questions

- None.
