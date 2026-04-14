## Context

当前实现把“会话删除”定义为仅允许删除空闲会话。后端在删除路由前调用占用态校验，前端也在历史 rail 和 store 层阻止删除活跃会话。这个模型在产品上已经不成立，因为用户希望运行中、停止收敛中和等待问题回答的会话都能删除。

当前代码还存在两个结构性风险：

- 后端会话写入路径不是单点，`appendMessage`、summary、plan、interaction、protocol state 和 workspace session metadata 都可能在删除后继续写回同一个 `sessionId`。
- 前端对会话的本地状态恢复不是单点，stream、reload、hydrate、session list refresh 都可能在删除后再次把该会话放回 UI。

这意味着“放开删除限制”会导致删除后复活、孤儿数据和前后端状态不一致。该变更必须跨越 `apps/agent-backend` 和 `apps/web` 共同完成，且需要新增一层删除生命周期语义。

## Goals / Non-Goals

**Goals:**

- 允许删除 `running`、`stop-pending` 和 `awaiting-question` 会话。
- 让删除在用户视角上立即生效，被删会话立刻从历史和当前视图中消失。
- 保证删除后同一 `sessionId` 不会被旧 run、旧 interaction、旧 hydrate 或旧 stream 写回。
- 保持现有批量清理语义不变，批量清理仍然只删除 idle 历史会话。
- 不引入第三方依赖，不调整现有顶层目录结构。

**Non-Goals:**

- 不删除 `user + agent` 级共享 workspace 文件。
- 不改变 session delete API 的基础路由形态。
- 不把 bulk clear 改成可删除 active session。
- 不在本次变更中引入后台异步回收任务或新的跨进程协调组件。

## Decisions

### 1. 使用独立 tombstone 表表达“会话已删除且不可再写”

决策：

- 在 `apps/agent-backend` 的 session store schema 中新增独立 tombstone 表，按 `(user_id, agent_id, session_id)` 建唯一键并记录 `deleted_at`。
- 删除请求一旦开始，先写入 tombstone，再做会话数据 purge。
- 所有 session 级写操作在真正写库前都先检查 tombstone，命中则显式失败。

原因：

- 这里需要的不是普通软删，而是“这个 sessionId 从此不可再写”的强约束。
- 仅靠 `agent_sessions.deleted_at` 不足以拦住 `agent_session_messages`、plans、interactions 等无外键表的后续写入。
- 独立 tombstone 可以在主会话记录被物理删除后继续存在，持续阻断 stale writer。

备选方案：

- 只在 `agent_sessions` 上加 `deleted_at`。放弃，因为主记录被 purge 后无法继续作为写入屏障。
- 完全依赖运行取消而不做 tombstone。放弃，因为取消不是同步完成，且 `awaiting-question` 没有 run 可取消。

### 2. 删除采用“tombstone -> purge -> release runtime”编排

决策：

- 删除路由不再先做“活跃会话禁止删除”的统一校验。
- `deleteSession` 改为专门删除编排：
  1. 读取当前 occupancy 与相关 run 信息。
  2. 写入 tombstone。
  3. 物理删除该 session 的 messages、summaries、plans、interactions、session meta。
  4. 若存在 `running`/`stop-pending` run，则发起 `cancelRun(runId)`。
  5. 若处于 `awaiting-question`，则立即清理对应 occupancy。
  6. 返回删除成功。

原因：

- 先 tombstone 才能保证 purge 之后的任何迟到写入都被拦住。
- 先 purge 再 release runtime，用户能更快看到删除结果；迟到 run 即使继续收尾也无法把会话写回。
- `awaiting-question` 不依赖活跃 run，必须显式释放其占用态。

备选方案：

- 先 cancel，再等 run 结束后删除。放弃，因为前端“立即消失”的产品语义会被 run 结束时间拖慢。
- 只删持久化数据，不触碰 runtime occupancy。放弃，因为会留下“会话没了但运行锁还在”的内存态脏数据。

### 3. 前端使用 deleted-session guard，而不是一次性本地清理

决策：

- workbench store 增加本地 `deletedSessionIds` 集合。
- 用户确认删除后，先把 `sessionId` 加入该集合，并立即从 `sessions`、当前会话视图和本地会话状态中移除。
- 所有会把 session 写回 store 的入口都先检查该集合；命中则忽略这次回流。

需要 guard 的入口至少包括：

- `updateSessionState`
- session activity / run state 同步
- `handleStreamEvent`
- `refreshSessions`
- `reloadSessionMessages`
- `reloadSessionState`
- `selectSession`
- 当前 run 完成后的会话 reload / convergence 路径

原因：

- 当前 `deleteSessionLocalState()` 只是一锤子清理；后续任何 `updateSessionState(sessionId, ...)` 都会重新创建空 state。
- 前端即使删除成功，旧 stream、旧 bootstrap、旧 listSessions 返回值仍可能把相同 `sessionId` 重新塞回界面。

备选方案：

- 只在删除动作里清一次本地 state。放弃，因为无法覆盖后续回流。
- 仅在 API 层过滤 delete 后的 404。放弃，因为已有的本地流式上下文仍会继续写本地状态。

### 4. 删除失败时前端回滚本地删除态

决策：

- 删除动作采用 optimistic removal。
- 如果 delete API 最终失败，前端移除本地 tombstone/guard，刷新 sessions 和当前治理状态，并恢复错误提示。

原因：

- 用户明确要求“立即消失”。
- 只有本地先移除才能满足 UI 语义；但失败时必须可恢复，否则前端会比真实后端状态更激进。

备选方案：

- 等后端确认后再移除 UI。放弃，因为与产品语义冲突。

## Risks / Trade-offs

- [Risk] 迟到 run 在删除后仍会执行一小段逻辑并命中 tombstone 异常
  → Mitigation: 为 tombstoned session 提供可识别的显式运行时失败语义，并在日志中保留删除导致中止的信息，避免静默吞掉。

- [Risk] Session store 写路径多，漏掉任一入口都可能形成复活路径
  → Mitigation: 把 tombstone 检查收敛为统一 helper，并用 sessionStore 测试覆盖消息、summary、plan、interaction、protocol state 等路径。

- [Risk] 前端 guard 入口多，漏拦任一路径都可能把已删会话重新显示
  → Mitigation: 以 `deletedSessionIds` 为统一判定来源，在公共写入口和 list refresh 上做集中拦截，并补充 store 级回归测试。

- [Risk] 已删会话的迟到请求可能从“成功”变为“not found / deleted”
  → Mitigation: 这是预期变化，删除后不再保证该 session 仍可继续交互；错误要显式暴露而不是做 silent fallback。

## Migration Plan

1. 新增 tombstone 表 schema，并保持现有会话数据兼容；该表无需历史回填。
2. 落地后端删除编排与 session store 写保护。
3. 落地前端 optimistic deletion 与 deleted-session guard。
4. 更新路由、store 和 session store 测试，覆盖 active deletion 与防复活语义。

回滚策略：

- 若需回滚，可恢复旧删除限制逻辑并停止写入 tombstone；已存在的 tombstone 只会阻止已删除 sessionId 被继续写入，不影响新建 session，因为新 session 使用新的 UUID。

## Open Questions

- None.
