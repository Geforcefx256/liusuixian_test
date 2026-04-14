## Context

当前 workbench 已经支持同一 Agent 下多个 session 并发运行，但前端 store 仍然混用了三类不同归属的状态：

- 当前查看中的 session：由 `activeSessionId` 表示
- 某次 run 实际所属的 session：由流式上下文 `context.sessionId` 表示
- 某次异步加载请求所属的视图代次：当前没有独立建模

现状里，消息正文和 run 流事件大多已经按 `sessionId` 归属，但 `latestStatus`、`latestPlanSummary` 仍是全局字段，`selectSession()` / `reloadSessionState()` 只校验 `activeSessionId === sessionId`，而 `runConversationInput()` 的异常分支仍会读取当前 `activeSessionId` 来清理运行态。结果是：

- 后台 session 的计划或终态会覆盖当前会话右侧面板，造成“串台”观感
- 同一 session 的旧加载响应可能覆盖较新的会话视图
- run 在切走后失败时，前端可能清错 session 的运行态或错误占位消息

这次变更只修正前端 workbench 的状态归属和异步回写协议，不改变后端的 session 锁、消息持久化和并发运行语义。

## Goals / Non-Goals

**Goals:**
- 让会话级状态面板只展示当前 session 自己的运行状态、计划摘要和终态信息。
- 让 session 切换和显式重载在快速来回切换时保持确定性，避免旧响应覆盖新视图。
- 让 run 的失败、取消和终态清理严格绑定到 run-owning session。
- 用可回归的 store 测试覆盖这些前端竞态路径。

**Non-Goals:**
- 不调整后端 `user + agent + session` 的 run 隔离或消息持久化逻辑。
- 不改变共享 workspace 语义，也不引入新的文件冲突治理。
- 不重构 workbench 的整体布局、历史 rail 或 conversation pane 信息架构。
- 不引入新的第三方依赖，也不要求新增请求取消基础设施。

## Decisions

### 1. 将会话级状态面板数据改为按 session 存储，而不是继续复用全局字段

会话相关的运行状态、计划摘要和终态文案将归属到 session-scoped state，并由当前 `activeSessionId` 投影到右侧上下文面板。全局状态字段只保留给工作区文件操作、会话列表管理等非会话归属动作。

Rationale:
- 当前问题的根因不是“面板展示错了”，而是会话归属状态本身被建模成了全局单例。
- 只有把状态源头改成 session-scoped，后台 session 更新时才不会污染前台 session 面板。

Alternatives considered:
- 在更新 `latestStatus` / `latestPlanSummary` 时增加 `activeSessionId === context.sessionId` 守卫：拒绝。这样会丢失后台 session 的状态积累，切回原 session 时也无法恢复正确上下文。
- 保持全局字段不变，仅在组件层过滤显示：拒绝。这样只隐藏了表现层问题，无法解决状态被覆盖后的恢复语义。

### 2. 为 session hydration 引入按 session 的请求代次，而不是只比较 sessionId

`selectSession()` 和 `reloadSessionState()` 将为每个 session 维护单调递增的加载代次。异步请求返回时，除了验证当前活动 session，还必须验证这次响应仍然属于该 session 的最新代次，过期响应必须丢弃。

Rationale:
- 现有 `activeSessionId === sessionId` 只能挡住“别的 session 覆盖当前 session”，挡不住“同一个 session 的旧响应覆盖新响应”。
- 代次比较实现简单，且不要求 API 层先支持 `AbortController` 或取消 token。

Alternatives considered:
- 为所有读取请求补充取消能力：暂不采用。取消能力可以作为后续优化，但不是修复错写视图的必要条件。
- 继续只依赖 `activeSessionId`：拒绝，因为无法处理 `A -> B -> A` 时同一 session 的乱序返回。

### 3. run 生命周期清理统一绑定到 run-owning session

run 发起后，前端必须在异步边界之前捕获不可变的 run ownership，包括目标 session、乐观 assistant 消息归属以及 run 本地上下文。后续成功、失败、取消、等待问题和收敛清理都只能使用这份 ownership 信息，不能再回退到 `activeSessionId` 推断目标。

Rationale:
- “当前正在看哪个 session”与“这次 run 属于哪个 session”是两件不同的事。
- 一旦异常分支继续读取 `activeSessionId`，切换页签后就会清错对象。

Alternatives considered:
- 在 `catch` 分支增加 `if (activeSessionId.value === sessionId)` 才清理：拒绝。这会留下 run-owning session 的脏运行态，而不是修正归属。
- 在失败后强制 reload 当前会话：拒绝。当前会话未必是 run-owning session，且会引入新的视图闪动和竞态。

### 4. 用 store 级竞态测试作为验收主线

这次变更的核心是状态归属和异步时序，主要验收应放在 `workbenchStore` 测试，而不是依赖手工点击验证。测试将覆盖：

- 后台 session 产生 `plan.snapshot` / `run.completed` 时不污染前台 session 面板
- `A -> B -> A` 快速切换时，旧 A 响应不会覆盖新 A
- session A 发起 run、切到 B、A 失败或取消后，只清理 A 的运行态

Rationale:
- 这类问题复现依赖时序，不稳定且很难靠手工回归覆盖完整。
- store 已经有“流式正文归属不串 session”的测试，继续在同一层补竞态测试成本最低。

## Risks / Trade-offs

- [session-scoped UI 状态增加前端本地状态面] → 复用现有 session 本地状态生命周期，在会话删除、清空或重置时同步清理对应切片。
- [请求代次只能丢弃过期结果，不能减少无效请求数量] → 先保证正确性；若后续需要优化资源占用，再单独引入请求取消能力。
- [空白草稿到新 session 的过渡仍然存在异步边界] → 在实现时沿用同一 ownership 传递路径，避免重新回落到 `activeSessionId` 推断。

## Migration Plan

1. 调整 workbench store 的 session-scoped state 结构，区分会话归属状态与全局工作区状态。
2. 为 session 选择和重载逻辑增加代次校验，统一封装异步回填入口。
3. 调整 run 发起与异常分支，确保所有生命周期清理按 run-owning session 落盘到本地状态。
4. 更新上下文面板绑定逻辑与 store 测试，覆盖后台更新、快速切换和异常清理场景。

Rollback strategy:
- 该变更仅涉及前端 store 与 workbench 面板绑定，无数据迁移。
- 若需要回滚，可整体回退本次前端状态归属改动，无需变更后端或数据库状态。

## Open Questions

- 无阻塞性开放问题。
