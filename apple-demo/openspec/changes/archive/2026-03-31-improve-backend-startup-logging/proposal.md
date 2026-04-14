## Why

当前 `apps/web-backend` 和 `apps/agent-backend` 在本地启动时只打印零散的监听信息，配置来源、实际生效端口、健康检查地址，以及启动阶段的告警或异常上下文都不够集中。遇到诸如 MML 规则目录缺失、Node `ExperimentalWarning`、配置加载失败或启动中断时，开发者需要翻代码才能判断服务到底加载了什么、监听在哪、以及哪些异常只是告警、哪些会阻断启动。

## What Changes

- 为 `apps/web-backend` 和 `apps/agent-backend` 增加统一的启动摘要日志，明确打印服务名、协议、host、port、基础地址与 health 接口地址。
- 在启动日志中补充关键配置加载结果，至少覆盖配置文件来源、关键路径或目录、以及对当前服务启动诊断最有价值的已生效配置项。
- 为 backend 进程补充 `warning`、`uncaughtException`、`unhandledRejection` 等诊断输出，让启动阶段和运行阶段的异常上下文都能直接出现在控制台或现有日志通道里。
- 保持现有业务路由、配置 schema 与依赖不变，只增强本地与运维排障所需的启动可观测性。

## Capabilities

### New Capabilities

- `backend-startup-diagnostics`: 定义 `apps/web-backend` 与 `apps/agent-backend` 在启动成功、启动告警和启动失败场景下必须输出的诊断日志。

### Modified Capabilities

None.

## Impact

- Affected code: `apps/web-backend/src/app.ts`, `apps/web-backend/src/config/index.ts`, `apps/web-backend/src/mmlRules/bootstrap.ts`, `apps/agent-backend/src/index.ts`, and any shared startup logging helpers added under those app packages.
- Affected systems: backend startup logging, local developer diagnostics, service bootstrap observability, and process-level warning/error reporting.
- No API contract changes beyond logging output, no dependency changes, and no top-level monorepo restructuring.
