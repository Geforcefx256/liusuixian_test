## Context

当前后端已经把每条 assistant 回复的 `meta.usage` 持久化到 session message，因此“单个 session 的累计 token”并不需要重新接入 provider 或修改 `/agent/run` 执行链路。问题在于，这些 usage 数据还没有被聚合成历史会话层级的信息，前端历史面板也没有一个独立、低干扰的展示入口。

这次变更跨越 `apps/agent-backend` 与 `apps/web` 两个模块，并且有两个明确约束：
- 只在历史会话管理面板展示，不进入当前会话主聊天区。
- 只对 `admin` / `super_admin` 可见，普通用户完全不渲染。

另一个关键约束是故障隔离。token 统计只是运营辅助信息，不能与对话主链路绑定；即使 usage 查询失败，用户正常发起、恢复、切换或删除会话的行为都不能受影响。

## Goals / Non-Goals

**Goals:**
- 为单个 `sessionId` 提供基于已落库 assistant usage 的累计 token 查询能力。
- 将该能力暴露为管理员专用的独立接口，而不是塞入 `/agent/run` 或会话执行写路径。
- 在历史会话面板中以弱化 badge 展示本 session 累计 token。
- 保持 usage 展示失败时的显式非阻断行为，不伪造 `0 tok` 成功态。

**Non-Goals:**
- 不追求计费级别的精确账单口径，不补算“失败但已真实消耗”的未落库 token。
- 不在当前对话头部、消息气泡或主会话区新增 token 指标。
- 不为普通用户开放 usage 可视化或新增 usage 分析后台。
- 不引入新的第三方依赖，不调整现有 monorepo 顶层结构。

## Decisions

### Decision: Session 总 token 以已落库 assistant `meta.usage` 聚合为准

第一版 session usage 直接定义为“该 session 下所有 assistant message 的 `meta.usage.totalTokens` 之和”，并同步汇总 `inputTokens`、`outputTokens`、`cacheReadTokens`、`cacheWriteTokens` 和命中消息数。

Rationale:
- 现有数据源已经存在，复用成本最低，不需要改 provider 协议或补写新的审计表。
- 该口径与用户真正想看的“这段会话已经累计花了多少 token”基本一致。
- 已落库 usage 是当前系统里最稳定、最容易验证的真实来源。

Alternatives considered:
- 从 run 事件流实时累计：需要新增状态同步链路，且更容易与对话主路径耦合。
- 按账单口径重算所有请求：复杂度高，而且当前仓库没有现成账单模型。

### Decision: 使用独立的 admin-only session usage 接口，而不是扩展 `/agent/run`

后端新增独立的 session usage 查询接口，由管理员在历史会话面板按需读取；它不参与 run admission、streaming、消息写入或会话创建路径。

Rationale:
- usage 展示不应成为对话主链路的前置条件。
- 独立接口可以把权限校验、聚合失败和 UI 加载时序与聊天执行彻底解耦。
- 这也符合用户对“功能挂了不该影响对话”的要求。

Alternatives considered:
- 在 `/agent/run` 响应里顺带返回累计 usage：会把非核心统计绑进主执行路径。
- 直接扩展 session list 主接口：虽然也不影响聊天，但会让历史面板主加载和 usage 聚合共失败，隔离性更差。

### Decision: 历史面板按 session 单独查询 usage，失败按缺失处理，不伪装为零

前端仅在管理员打开历史会话面板后，针对列表中的 session 按需请求 usage。若某个请求失败，只隐藏该条 badge，不把失败展示成 `0 tok`，也不阻塞其他会话项。

Rationale:
- 单条查询实现最小，不需要在第一版引入批量聚合契约。
- 单条失败天然局部化，最符合“非阻断”的目标。
- “无 badge”能显式区分“未成功取到 usage”与“真实为 0”这两种状态，避免静默假成功。

Alternatives considered:
- 一次性批量接口：后续可做，但第一版会扩大接口与测试面。
- 失败时回退显示 `0 tok`：违反调试优先原则，会掩盖真实问题。

### Decision: token badge 只出现在历史会话面板，且视觉层级弱于标题与时间

管理员历史会话项在第二行右侧显示弱化的 token badge，例如 `[18.2k tok]`；当前会话头部、消息区和普通用户视图不显示该信息，也不预留空位。

Rationale:
- 这个信息的消费场景是历史会话管理，不是当前对话阅读。
- 用户已经明确选择“第二种方案”，即 badge 只放在历史会话面板。
- 降低视觉优先级可以避免成本信息反客为主。

Alternatives considered:
- 当前会话头部展示累计 token：会干扰普通使用流程。
- 普通用户也显示：信息噪音高，实际价值低。

## Risks / Trade-offs

- [只统计已落库 assistant usage，会少算部分失败请求] → 在设计上明确这是“已落库回复累计消耗”口径，不伪装成计费账单。
- [管理员会话较多时，逐条请求 usage 可能增加历史面板请求数] → 第一版限定在 admin 场景，且仅影响历史面板；后续若必要再演进为批量接口。
- [usage 聚合失败若处理不当，会被误读成真实零消耗] → 前端失败时不渲染 badge，不返回伪造零值。
- [权限判断分散在多个前端组件中可能导致漏显] → 复用现有 `admin` / `super_admin` 判断来源，避免重新定义角色逻辑。

## Migration Plan

1. 在 backend session store 中新增 session usage summary 类型与聚合读取方法，复用已持久化 message usage。
2. 在 agent 路由中新增 admin-only usage 查询接口，并保持与 run 链路解耦。
3. 在 web 端补充 usage API 类型与请求方法，仅在管理员历史面板加载时触发。
4. 在历史会话列表项中增加弱化 token badge，并确保普通用户完全不渲染。
5. 通过类型检查与相关测试验证：查询成功时展示 badge，查询失败时历史列表与对话能力不受影响。

## Open Questions

- None.
