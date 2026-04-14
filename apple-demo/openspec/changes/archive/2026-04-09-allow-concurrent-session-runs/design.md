## Context

当前基线已经通过 `2026-04-05-enforce-single-workspace-active-run` 把同一 `user + agent` 共享工作区的运行语义收紧为“单活跃 owner”。后端以 `userId + agentId` 作为全局占用键拒绝第二个 session 的 run，前端则用单一 `activeRun` / `isRunning` / `workspaceOccupancy` 建模整个 workbench 的运行态。

这套语义与“多个会话共享同一个 working 区，但会话本身仍然是独立对话线程”的产品预期并不匹配。用户现在明确要求恢复为：

- 继续共用同一个 `user + agent` working 区。
- 不做排队。
- 暂不处理共享 working 区的写冲突。
- 不同 session 可以同时 run。
- 同一个 session 仍保持单 run；若处于 `awaiting-question`，该 session 只能继续走专用答复流程，不能普通发送。
- 删除与清空历史不再按 workspace 全局锁死，只保护活跃 session。

这意味着本次不是引入新的工作区模型，而是把运行协调、前端状态建模和历史治理从“workspace 全局 owner”调整为“session 级活跃状态”。

## Goals / Non-Goals

**Goals:**
- 允许同一 `user + agent` 共享工作区中的多个 session 并发运行。
- 保持单个 session 内的 run 生命周期、pending question 生命周期和 stop/cancel 语义自洽。
- 让前端按 session 追踪运行态，使同页签切换会话后仍能继续发送或返回原会话 stop。
- 让会话删除和批量清理只保护活跃 session，而不是因为别的 session 活跃而整体锁死。
- 保持现有共享 working 区、上传文件、输出文件和 workspace sidebar 语义不变。

**Non-Goals:**
- 不把 working 区改成按 session 隔离。
- 不引入 blocked run queue 或排队提示。
- 不为共享文件写入新增冲突检测、合并策略或 source attribution。
- 不重做 workbench 总体布局或信息架构。
- 不引入新的第三方依赖或调整 monorepo 顶层目录结构。

## Decisions

### 1. 后端运行协调改为“shared workspace + session-local active state”

后端仍然以 `user + agent` 解析共享工作区，但不再把它当作单 owner 互斥锁。运行 admission 改为按 `sessionId` 判断：

- 同一 session 已有活跃 run 时，拒绝再次发起 run。
- 同一 session 有 unresolved pending question 时，拒绝普通 run，要求继续使用该 session 的答复/拒绝路径。
- 其他 session 不受该 session 活跃状态影响，可以继续发起 run。

Rationale:
- 这正好匹配用户要求的最小产品语义。
- 共享工作区无需重建，影响面主要集中在 run coordination 层。

Alternatives considered:
- 保留 `user + agent` 全局锁，仅前端放开：拒绝，因为 API 和多页签仍会被后端挡住。
- 为每个 session 创建独立工作区：拒绝，因为这会扩大为文件模型和目录结构改造。
- 增加排队：拒绝，因为用户已明确不要排队。

### 2. pending question 继续占用 session，而不是占用整个 workspace

`awaiting-question` 语义保留，但限制只作用于提问所属 session。该 session 在问题未答复或未拒绝前不能继续普通发送；其他 session 不应被连带阻塞。

Rationale:
- 问题跟随具体对话上下文，而不是整个共享文件空间。
- 这能保留原有 question flow 的严谨性，同时去掉不必要的跨会话阻塞。

Alternatives considered:
- pending question 也完全不阻塞原 session：拒绝，因为会打乱 continuation flow。
- pending question 继续占用整个 workspace：拒绝，因为与并发 session 目标直接冲突。

### 3. 前端从单 run 模型改为按 session 追踪运行态

前端 store 需要从全局 `activeRun` / `isRunning` / `workspaceOccupancy` 迁移为 session-keyed state，例如：

- 每个 session 的 run 状态、run id、stop-pending、awaiting-question、error、latest status 分别维护。
- 当前会话的 composer 可发送性由“当前 session 是否活跃或 pending question”推导，而不是由整个 workspace 是否被占用推导。
- 流式事件和生命周期更新必须按 session 落到正确的会话切片，不能依赖当前可见页签。

Rationale:
- 只放开后端不改前端，UI 仍会表现成“同页签一次只能跑一个”。
- session-keyed state 是支持切会话继续发、返回原会话 stop、并发 run 不串状态的必要条件。

Alternatives considered:
- 继续保留全局运行态，只在少量按钮判断里放宽：拒绝，因为状态串线和事件投递错误会持续存在。

### 4. 历史治理改为“活跃 session 保护”，而不是“workspace 全局禁删”

删除和清空历史都改成以目标 session 是否活跃为准：

- 删除单个 session 时，仅当该 session 自己有活跃 run 或 unresolved pending question 才拒绝。
- 批量清空历史时，当前选中 session 继续默认排除；其他历史 session 中如有活跃 session，也必须跳过而不是整体失败。
- 返回结果需要能让前端区分“成功删除的 session”和“因活跃而保留的 session”。

Rationale:
- 这与“允许多个 session 同时跑”一致。
- 可以避免把一个 session 的活跃状态扩大成整个历史 rail 的全局锁。

Alternatives considered:
- 仍然全局禁止删除和清空：拒绝，因为会直接抵消并发 session 的可用性。
- 删除前自动 stop/cancel 活跃 session：拒绝，因为这会把 destructive action 和运行控制隐式耦合。

### 5. 共享工作区语义保持不变，并明确接受短期写冲突风险

文件目录、workspace metadata、上传文件与工具输出依旧按 `user + agent` 共享；本次不为多 session 并发写入增加额外边界规则、fallback 或静默冲突处理。

Rationale:
- 用户已明确接受当前阶段不处理写冲突。
- 这让改动聚焦在会话运行治理，而不是扩展成文件协作系统。

Alternatives considered:
- 为并发写入加乐观锁或版本比较：当前不做，因为会显著扩大实现范围。

### 6. 前后端需要成对交付，不做兼容性过渡层

后端返回的 session 活跃状态与删除/清空历史语义变化，必须由前端同步消费。该变更应视为一个联动交付单元，而不是通过 silent fallback 兼容旧模型。

Rationale:
- 当前基线的全局占用模型已经深度进入前后端实现。
- 用户要求 debug-first，不引入隐藏降级路径。

Alternatives considered:
- 先改后端、前端靠旧逻辑兼容：拒绝，因为用户表面仍会看到单 run 行为。

## Risks / Trade-offs

- [共享 working 区存在真实并发写风险] → 本次明确接受该风险，不引入静默冲突处理；问题应通过显式错误或后续独立变更解决。
- [前端状态拆分后更容易出现 run/stop/status 串会话] → 所有运行生命周期数据必须带 `sessionId` 收口，并补充 store 级回归测试。
- [历史清理结果不再是“全成或全不成”] → API 与 UI 都要显式表达被跳过的活跃 session，避免误以为全部已删除。
- [前后端若只发布一侧会产生语义错位] → 作为同一变更联合发布与回滚，不做半套切换。

## Migration Plan

1. 调整后端 run coordination、bootstrap/session metadata 和历史删除语义，使运行态按 session 追踪。
2. 调整前端 store 为 session-keyed run state，并让 shell、composer、history rail 基于当前 session 推导可发送性和 stop 控制。
3. 更新删除与批量清理交互，使其仅保护活跃 session，并在结果中体现被跳过对象。
4. 补充后端与前端测试，覆盖多 session 并发运行、pending question 隔离、切会话继续发送、活跃 session 保护删除/清理等路径。

Rollback strategy:
- 以前后端为一个整体回滚到当前全局 occupancy 模型。
- 不单独回滚某一侧，避免 session 级与 workspace 级语义混杂。

## Open Questions

- 无阻塞性开放问题。
