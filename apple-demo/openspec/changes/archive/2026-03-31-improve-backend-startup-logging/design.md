## Context

`apps/web-backend` 当前主要在 `startServer()` 中打印一行 listen 地址，配置加载发生在 `src/config/index.ts` 顶层，但没有把“默认值还是 config.json 生效”、“SQLite/MML 规则路径是什么”、“health 地址是什么”集中输出。`apps/agent-backend` 已经有结构化 `entrypointLogger`，但 startup banner 仍然偏向内部运行时信息，缺少对 host/port/health/config source 的明确汇总，也没有统一兜住进程级 warning/error 事件。

这次变更是跨两个 backend 的运行时可观测性增强。核心约束是不能引入新依赖、不能改现有业务接口，只能在现有启动流程和日志能力上补齐稳定的诊断输出，让开发和排障时不必再根据源码反推启动状态。

## Goals / Non-Goals

**Goals:**
- 为 `web-backend` 和 `agent-backend` 提供一致、可扫描的启动摘要日志。
- 让日志明确显示配置来源、关键生效配置、监听地址和 health 接口地址。
- 捕获并打印进程级 `warning`、未处理异常和未处理 Promise rejection，避免告警静默丢失。
- 保持当前控制台输出和 `agent-backend` 结构化日志能力兼容，不新增第三方日志框架。

**Non-Goals:**
- 不修改现有 HTTP 路由、认证逻辑或数据库行为。
- 不新增远程日志上报、文件轮转策略或日志查询 UI。
- 不统一两个服务的全部日志格式，只聚焦启动诊断与进程级异常输出。
- 不变更 `config.json` schema，也不为本次改动引入新的依赖。

## Decisions

### 1. 为每个 backend 输出“启动摘要”而不是只补零散 `console.log`

启动后最需要的是一眼能看懂的摘要，包括服务名、配置来源、关键路径、监听地址和 health 地址。相比把这些信息散落在多个模块里，集中在启动路径上输出更稳定，也更方便后续测试断言。

Alternatives considered:
- 只在现有 listen 日志后追加一两个字段：被拒绝，因为仍然无法回答配置来源和 health 地址问题。
- 把详细配置分散到各初始化模块自己打印：被拒绝，因为会导致输出顺序不稳定且难以复用。

### 2. 复用各服务现有日志风格，但统一诊断字段内容

`web-backend` 目前主要是 `console.*` 输出，`agent-backend` 已有 `entrypointLogger`。本次不强推单一日志实现，而是在各自现有入口上输出相同语义的字段集合，减少改动面，同时保证开发者能在两个服务看到一致的诊断内容。

Alternatives considered:
- 立即抽一个跨 app 的共享日志库：被拒绝，因为本次需求只针对 startup observability，抽象成本大于收益。
- 把 `web-backend` 全量迁到结构化 logger：被拒绝，因为超出本次范围。

### 3. 在配置加载层暴露“来源 + 生效值摘要”，避免重复解析

`web-backend` 的配置在 `src/config/index.ts` 顶层加载，`agent-backend` 也有独立配置加载逻辑。最稳妥的方式是在配置模块旁暴露可复用的诊断摘要函数或元数据，让启动入口直接消费，而不是在入口里重复推导配置来源和关键路径。

Alternatives considered:
- 在启动入口里手工重新拼接所有配置值：被拒绝，因为容易与真实配置解析逻辑漂移。
- 只打印原始 `config.json` 路径：被拒绝，因为无法反映环境变量覆盖后的最终值。

### 4. 进程级 warning/error 统一挂在启动入口注册

Node 的 `warning`、`uncaughtException`、`unhandledRejection` 都属于进程级事件，适合在入口文件一次性注册。这样可以把像 `ExperimentalWarning` 这类信息和服务自身的启动日志放在同一诊断链路里，避免告警只由 Node 默认格式零散打印。

Alternatives considered:
- 依赖 Node 默认 stderr 输出，不做额外处理：被拒绝，因为无法保证格式一致，也无法补充服务名和上下文。
- 在各业务模块局部捕获错误：被拒绝，因为覆盖不到进程级异常。

## Risks / Trade-offs

- [启动日志过多会让本地控制台变嘈杂] → Mitigation: 限制摘要字段数量，只输出排障关键项，避免整份配置对象直出。
- [`warning`/异常既被 Node 默认打印又被自定义日志重复打印] → Mitigation: 明确只追加结构化摘要，避免再次完整复制超长原文，必要时使用统一前缀区分来源。
- [两个服务维持各自日志实现会有少量格式差异] → Mitigation: 在 spec 中统一必须出现的字段和语义，而不强制完全一致的序列化格式。
- [配置摘要可能误暴露敏感值] → Mitigation: 只打印来源、路径、布尔状态和“是否存在”类信息，不打印 secret 原文。

## Migration Plan

1. 为两个 backend 确认启动摘要所需的最小字段集合与输出时机。
2. 在各自配置/入口模块增加诊断摘要构造逻辑，避免重复解析配置。
3. 在启动成功路径补充服务摘要日志，在启动失败路径补充明确的错误摘要日志。
4. 在入口注册进程级 `warning`、`uncaughtException`、`unhandledRejection` 输出。
5. 为 `web-backend` 和 `agent-backend` 增加针对启动日志与异常输出的测试或可验证覆盖。
6. 回滚策略为代码回滚；本次不涉及数据迁移或配置 schema 迁移。

## Open Questions

- `web-backend` 是否需要采用与 `agent-backend` 完全一致的结构化 JSON 输出，还是只要满足字段语义一致即可。
- 进程级 `uncaughtException` 在打印后是否继续沿用现有退出行为，还是需要在本次顺手统一退出码策略。
