## Context

当前仓库的 `newui` 分支已经形成一套可工作的产品组合：`apps/web` 提供 Vue workbench，`apps/web-backend` 提供当前认证和用户管理上下文，`apps/agent-backend` 提供 agent runtime、workspace、managed skill governance 和 admin skill 管理接口。源仓库 `/Users/derrick92/Documents/code/codex/apple-demo` 的 `agent-V2-base` 分支则在 `agent-backend` 内部实现上继续演进，新增了工具黑名单、模型调用错误分类、日志文件落盘、若干 agent/runtime/memory 稳定性修复，以及依赖版本更新。

两边已经不是同一工程形态。源仓库已经演化为 `apps/* + packages/*` 的 monorepo，并且其前端运行时与当前 `newui` 前端并不一致。如果直接按分支覆盖合并，会同时引入前端 runtime 重构、认证语义变化、workspace 接口删除和 managed skill 行为变化，导致当前 `newui` 前端失效。

因此，这次变更不是“把源分支整体并过来”，而是“以当前产品契约为锚点，把源分支中已验证的后端能力做定向并集迁移”。

## Goals / Non-Goals

**Goals:**

- 将 `agent-V2-base` 中与 `apps/agent-backend` 相关的稳定后端能力迁入当前仓库
- 保持当前 `newui` 前端 API 契约、流式事件契约、workspace 契约和 admin skill 接口可用
- 保持当前认证上下文与角色判断语义，不让后端迁移破坏 `requireUser` / `requireAdmin`
- 保留 `managedSkillRegistry` 对技能暴露面和执行面的治理作用
- 引入 runtime tool deny list 作为更底层的工具限制机制
- 为 devlogs 增加服务端文件落盘与脱敏能力，而不迁移日志前端展示

**Non-Goals:**

- 不迁移源仓库 `apps/web`
- 不迁移源仓库 `packages/agent-core`、`packages/shared`、`packages/mml-core`
- 不将当前仓库改造成 pnpm monorepo
- 不引入源仓库的单点登录或认证收敛逻辑
- 不在本次变更中改写当前 `newui` 前端去适配新的后端契约

## Decisions

### Decision: 以前端现有契约为兼容基线

迁移后的 `apps/agent-backend` 必须继续兼容当前 `apps/web` 已消费的接口和数据结构，包括：

- `/agent/api/agents*`
- `/agent/api/runtime/bootstrap`
- `/agent/api/agent/sessions*`
- `/agent/api/agent/workspace`
- `/agent/api/agent/run`
- `/agent/api/files/upload`
- `/agent/api/admin/skills*`

这意味着不能直接采用源分支的 `routes/agent.ts`，因为源分支移除了当前前端仍在使用的 workspace 接口。替代方案是保留当前 route contract，在其下手工吸收源分支的内部实现增强。

### Decision: 以当前认证上下文为准，排除源分支 SSO/认证收敛逻辑

当前仓库的认证上下文会返回用户角色，且 `requireAdmin` 与 admin skill 管理功能依赖该语义。源分支 `authClient` 收窄为只识别 `userId`，并不满足当前产品链路。

因此保留当前 `auth/*` 的契约与行为，源分支认证收敛和单点登录相关差异不迁移。这样可以避免迁移后 admin skill API、用户菜单和角色判断退化。

### Decision: 保留 managed skill governance，同时引入 tool deny list

当前分支的 `managedSkillRegistry` 并不只是前台展示数据，它已经接入：

- `AgentCatalogService` 的技能可见面
- `SkillToolProvider` 的技能暴露与拒绝逻辑
- admin skill 管理接口

源分支新增的 `ToolProviderRegistry.deny` 则是另一层更底的 runtime 工具黑名单。两者解决的问题不同：

- `managedSkillRegistry` 负责“哪些 skill 属于可治理的产品面”
- `toolDenyList` 负责“哪些 runtime tool 在当前配置下整体不可用”

因此采用并存方案：保留当前 governed skill surface 逻辑，同时引入源分支 deny 机制，避免二选一导致行为回退。

### Decision: 区分“关闭本地工具”和“删除配置型工具面”

这次额外调整里，三类工具并不适合同一种处理方式：

- `local:search_in_files` 是当前仓库内建的本地工具实现
- `gateway:local:transform_rows` 是由 `gateway.config.json` 生成的配置型工具
- `mcp:default:transform_rows` 是由 MCP 配置生成的配置型工具，且在缺少专用配置文件时会回退到默认 `transform_rows`

因此采用分层策略：

- 对 `local:search_in_files` 使用 `runtime.tools.deny` 做运行时关闭，保持实现文件和 provider 接线不变
- 对 `gateway:local:transform_rows` 直接从 `gateway.config.json` 的交付配置中移除，而不是只做 deny
- 对 `mcp:default:transform_rows` 新增显式 `mcp.config.json` 覆盖默认 MCP 配置，并在其中移除 `transform_rows`，避免默认回退重新暴露该工具

这样能满足用户对“本地搜索工具仅关闭、gateway/MCP transform_rows 彻底删除”的语义差异，同时避免后续 catalog 或 bootstrap 因默认配置回退而重新出现已删除工具。

### Decision: devlogs 只迁服务端落盘链路

当前仓库已经有 devlogs 路由与内存态日志链路，源分支则新增了 JSONL 文件 sink、脱敏和关闭 sink 的清理逻辑。用户已明确不需要日志前端展示能力。

因此只迁移以下能力：

- `DailyJsonlDevLogSink`
- 日志脱敏
- 启动时挂载 sink
- 退出时关闭 sink

源分支的日志前端入口、页面和视图模型不迁移。

### Decision: 目录结构保持当前 `apps/*` 布局

即使依赖版本会向源仓库靠拢，本次仍保持当前仓库的 `apps/agent-backend` 单包布局，不引入 `pnpm-workspace.yaml`、`packages/*` 或 monorepo 依赖关系。这样可以把迁移范围限制在后端能力并集，而不是工程结构重组。

### Decision: 采用“内部实现定向并集”而不是“文件整包覆盖”

下列区域允许吸收源分支实现：

- `agent/`
- `runtime/`
- `memory/`
- `devlogs/`
- `support/`
- 部分 `routes/` 的内部逻辑

下列区域以当前分支为主，只允许局部合并：

- `auth/`
- `routes/agent.ts`
- `agents/service.ts`
- `runtime/tools/providers/skillProvider.ts`
- `runtime/tools/index.ts`
- `src/index.ts`

这个策略能减少把源分支行为回退带进当前产品的风险。

## Risks / Trade-offs

- [后端内部实现迁移后破坏当前前端契约] → 先以当前 `apps/web` 消费的接口面做兼容清单，route 层以当前分支为准，只迁内部逻辑
- [引入 `toolDenyList` 后与 managed skill governance 叠加导致技能不可见或不可执行] → 将两者职责明确分层，并为 governance + deny 共存增加测试
- [源分支 agent/runtime/memory 文件直接覆盖带入认证或 workspace 行为回退] → 对 `auth/*`、`routes/agent.ts`、`agents/service.ts`、`skillProvider.ts` 采用手工并集，不做整文件覆盖
- [日志落盘引入后造成敏感信息写盘] → 迁移源分支 redaction 逻辑，并在 sink 配置中默认启用脱敏
- [依赖版本上调引入构建或测试回归] → 以 `agent-backend` 相关依赖为主做增量对齐，迁移后用现有前后端检查验证关键链路

## Migration Plan

1. 冻结当前 `newui` 前端依赖的 `agent-backend` 接口与 payload 契约
2. 将源分支中 `agent-backend` 的底层能力分批迁入当前 `apps/agent-backend`
3. 在 route/auth/governance 边界层做手工并集，避免覆盖当前产品语义
4. 单独补入 devlogs 文件落盘与脱敏能力
5. 对 `agent-backend` 相关依赖版本和测试基线做必要对齐
6. 用当前 `newui` 前端入口验证 workbench、session、workspace、run stream、admin skill 管理仍可工作

回滚策略：

- 若迁移中的某一批内部实现导致前端契约破坏，可按模块回退对应后端改动而不需要回退前端
- route/auth/governance 文件保持当前契约主导，出现冲突时优先保留当前产品行为

## Open Questions

- 是否需要在本次变更中同步迁入源分支 `write_file` 本地工具，还是把它视为可选增强
- 依赖版本对齐时是否仅限 `apps/agent-backend/package.json`，还是要同步考虑与 `apps/web-backend` 的共享类型/运行时兼容性
