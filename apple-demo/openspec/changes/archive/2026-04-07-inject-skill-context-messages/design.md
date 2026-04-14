## Context

当前 `agent-backend` 中，`skill:skill` 的完整 `SKILL.md` 正文仍通过 tool summary 返回，并作为 `tool` part 持久化到会话里。主执行链路随后只会把该 tool result 作为普通工具轨迹的一部分发送给模型，而不会把 skill 内容升级成独立的上下文消息。

这带来三个问题：

- skill 遵循稳定性不足：模型后续是否继续显式参考该 tool result，不受 runtime 保证。
- retention 语义脆弱：当前 retained-skill 依赖扫描 `skill:skill` 的成功 tool output，并通过字符串模式提取 skill 内容。
- 展示与运行时耦合：如果未来继续增强 skill 运行语义，单纯依赖 `summary` 文本会把“可见工具回执”和“运行时上下文注入”混在同一个字段里。

本次改造只覆盖主 `agentLoop` 链路，不处理 `plannerLoop`。同时保持现有 workbench 聊天气泡体验不变：skill 内容不作为普通 assistant 消息展示，也不提供折叠查看。

## Goals / Non-Goals

**Goals:**

- 让 `skill:skill` 在调用成功后，把 canonical skill 内容显式注入为 runtime 可见的隐藏上下文消息。
- 让隐藏 skill-context message 持久化到 session history，以支持续跑、重放和上下文恢复。
- 让 retained-skill 重建逻辑从“扫描 tool output”升级成“读取显式 skill-context message”。
- 保持前端正常会话历史与聊天气泡基本不变，不向普通历史视图返回隐藏 skill-context message。
- 控制日志体积，避免记录完整 skill 正文。

**Non-Goals:**

- 不修改 planner 专用执行链路。
- 不引入新的第三方依赖。
- 不把 skill-context message 暴露为新的前端可见消息卡片。
- 不把 skill 加载扩展为自动权限提升、自动执行模板、或 fork agent 的宏工作流。

## Decisions

### 1. 为工具调用结果增加 typed side effects，而不是复用 `summary` 做隐式协议

工具成功结果将新增显式 side effect 通道，用于承载 injected messages。`summary` 仅保留给操作者和 tool trace 的简短回执，例如“已加载 skill 并注入上下文”。

选择理由：

- 明确区分“工具对用户/日志可见的摘要”与“运行时需要附加到会话的上下文”。
- 避免继续通过解析 `summary` 文本推断运行时行为。
- 为后续其他需要注入上下文的工具预留统一机制。

备选方案：

- 继续把完整 skill 正文放在 `summary` 中，再由 agent loop 特判 `skill:skill`。
  这会延续字符串协议，且让工具轨迹与隐藏上下文重复存储。

### 2. skill 注入消息使用隐藏的 assistant session message，而不是新增 system role

成功调用 `skill:skill` 后，runtime 会额外持久化一条隐藏 assistant message，其语义为 `skill-context`，内容为 canonical skill 正文。

选择理由：

- 现有 session model 和 provider outbound path 已围绕 `user/assistant/tool` 组织，使用隐藏 assistant message 改动面更小。
- 避免把 `system` role 引入现有持久化、重放、压缩、UI 展示链路。
- skill 内容本质是给代理继续执行时参考的工作上下文，而不是产品级系统提示。

备选方案：

- 新增 `system` persisted message。
  这会扩大 provider、会话模型和上下文构造的改动面，超出本次目标。

### 3. 隐藏 skill-context message 需要持久化，但默认不进入前端历史消息视图

session store 的真实消息流会包含这些隐藏 skill-context message；用于前端展示的 session history view 会把它们过滤掉。

选择理由：

- 持久化后，重开会话、续跑和 compaction 才能共享一致语义。
- 过滤展示后，workbench 不需要新增普通气泡或折叠视图，前端改动最小。
- 运行时真实消息流与用户可见消息流分层，符合当前产品预期。

备选方案：

- 不持久化，只在一次请求内临时注入。
  这会让续跑、重放、会话恢复与上下文压缩失真。

### 4. retained-skill 重建改为读取显式 skill-context message，不再扫描 tool output

上下文管理与 retention 将以隐藏 skill-context message 的显式语义为准，而不是从 `skill:skill` 的 tool output 中匹配 `<skill_content ...>`。

选择理由：

- 去掉脆弱的字符串耦合。
- 让“skill 已经成为运行时上下文的一部分”在 retention 逻辑里有一等表示。
- 让后续压缩和调试更容易解释。

备选方案：

- 保留原有 tool output 扫描，同时新增隐藏消息。
  这会造成两套真相源并存，长期会增加维护成本。

### 5. compaction 仍保留 dedicated retained-skill reminder，但 skill 正文不应直接被摘要模型吞并

隐藏 skill-context message 参与 retention 提取，但在 compaction 输入中应避免把完整 skill 正文直接交给摘要模型；压缩后仍通过 dedicated retained-skill reminder 注回上下文。

选择理由：

- 避免长 skill 文本挤占摘要预算。
- 保持“摘要”和“已调用 skill 保留”分离，延续现有设计方向。
- 减少 skill 正文被摘要模型稀释或误改写的风险。

备选方案：

- 把 skill 内容和普通消息一起交给摘要模型自由总结。
  这会降低 canonical skill 指令在长会话中的稳定性。

## Risks / Trade-offs

- [真实消息流与展示消息流分离] → 需要在 session store、context manager、history view 三处同时维护一致的过滤规则，并补测试覆盖恢复场景。
- [隐藏 skill message 增加持久化体积] → 不记录全文日志，并在前端历史视图中过滤，避免把存储膨胀进一步传导到 UI。
- [planner 先不改] → 明确将 planner 排除在本次 change 外，避免 plan/build 行为差异被误解为 bug。
- [side effect 通道变成公共机制] → 第一版只让 `skill:skill` 使用，避免在同一 change 中扩散更多消费者。

## Migration Plan

1. 扩展 gateway tool invoke success payload，支持 typed injected-message side effects。
2. 扩展 session message 持久化模型，为隐藏/语义化消息增加可持久化属性。
3. 改造 `skill:skill` 与主 `agentLoop`，在成功调用后写入隐藏 skill-context message。
4. 调整 session history view，确保隐藏 skill-context message 不进入 workbench 普通历史接口。
5. 调整 retained-skill 与 compaction 逻辑，从显式 skill-context message 重建和回注。
6. 补齐运行时、session store、context manager 和 history view 的测试。

回滚策略：

- 如需回滚，可先停用 `skill:skill` 的 injected-message side effect，并继续保留简短 tool summary。
- 旧会话中已持久化的隐藏 skill message 即使存在，只要 history view 继续过滤，也不会影响前端普通展示。

## Open Questions

- 无阻塞性开放问题；当前产品决策已确认：隐藏 skill message 存库、参与上下文、不显示为普通气泡、不打印全文日志、planner 暂不纳入。
