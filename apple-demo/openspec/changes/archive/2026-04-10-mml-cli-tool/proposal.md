## Why

当前仓库中的 MML 能力分散在多个位置：

- `apps/web-backend/src/mmlRules/` 负责 Excel 规则导入、SQLite 存储与 schema 查询
- `apps/web/src/components/workbench/mmlSemantics.ts` 负责 MML 文本解析与基于 schema 的参数校验
- Agent 侧缺少统一、离线、可脚本化的 MML 能力入口

这带来两个实际问题：

1. 对规则目录而言，现有能力缺少统一的 CLI 入口，schema 查询、规则库初始化和命令校验无法被 Agent 或运维脚本稳定复用。
2. 对业务 `.mml` 文件而言，现有系统缺少按“文件 + 命令名 + 条件参数”查询存量命令实例的能力，无法高效提取实际实例化命令和参数值。

因此需要提供统一的 `mml` CLI：

- 面向规则目录，支持 schema 查询、规则库初始化、命令校验
- 面向业务 `.mml` 文件，支持命令实例检索、条件过滤和紧凑 JSON 输出

## What Changes

- 将该变更定义为 `mml-cli-tool`
- 在根目录新增 `cli-tools/` 顶层目录，创建 `cli-tools/mml/`
- 引入独立的 MML core 分层，统一承载：
  - schema contract
  - rules catalog access
  - workbook init (规则库全量初始化)
  - MML parse / validate semantics
  - business `.mml` file instance query
- `mml` CLI 提供以下命令：
  - `mml schema list` — 列出可用的网络类型和版本
  - `mml schema show --type --version` — 查看指定类型的完整参数 schema
  - `mml validate --type --version --command` — 验证 MML 命令是否符合规则
  - `mml init --dir` — 从 Excel 文件全量初始化规则库（部署后一次性操作）
  - `mml file query --file --command [--where ...] [--select ...]` — 查询业务 `.mml` 文件中的实际命令实例
- Agent-backend 新增轻量 skill（`mml-generation`），通过 governed script 调用 CLI / core 能力，不依赖裸 shell 命令

## Capabilities

### New Capabilities
- `mml-cli-tool`: 自包含的 MML CLI 工具，提供 schema 查询、规则库初始化、命令校验、业务 `.mml` 文件实例查询能力，遵循 agent 友好设计（紧凑 JSON 输出、语义化 exit code、完整 --help）
- `mml-cli-skill`: Agent 端的轻量 skill，指导 Agent 通过受治理脚本调用 mml CLI / core 能力

### Modified Capabilities

（无。web-backend 的 HTTP API 保持不变，不修改现有 spec）

## Impact

- **新增顶层目录**: 需要在根目录新增 `cli-tools/`，属于新增目录，不涉及删除/移动/重命名现有顶层目录，符合工程基线约束
- **pnpm workspace**: 需要在 `pnpm-workspace.yaml` 中添加 `cli-tools/*` 以支持 monorepo 构建
- **MML core 分层**: 需要统一规则目录、语义校验和文件实例查询相关的程序化 API，避免 CLI、前端和 agent 再次各自复制逻辑
- **新增依赖**: CLI 工具需要引入 `commander`（CLI 框架）和 `xlsx`（Excel 解析）；SQLite 方案与现有 web-backend 保持一致，基于 Node 22 内置 `node:sqlite`
- **数据兼容**: CLI 使用的 SQLite 数据库 schema 与 web-backend 兼容，可共享同一数据库文件
- **实例查询**: `mml file query` 直接对业务 `.mml` 文件做解析查询，不依赖规则数据库即可工作
- **Agent skill**: `apps/agent-backend/assets/skills/` 新增 skill 目录，并通过 `skill:exec` 接入受治理脚本执行路径
- **构建与发布**: 若 agent 需要在发布产物中使用该能力，需要将 skill script 和对应 runtime 入口纳入现有 `agent-backend` dist 组装流程
- **web-backend**: 不受影响，保持现有 HTTP API 和内部实现不变
