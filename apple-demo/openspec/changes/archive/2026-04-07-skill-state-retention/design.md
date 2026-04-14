## Context

当前仓库的 compact 主链是：

1. `skill:skill` 返回 canonical skill content，并作为普通 tool output 写入会话消息。
2. `ConversationCompactor` 只基于历史消息生成一份通用结构化摘要。
3. `ContextManager` 在后续构造上下文时，只注入摘要消息和 active tail。

这意味着：skill 内容虽然仍在持久化消息里，但不会作为“已调用 skill 的独立提醒”继续出现在 compact 后的上下文中。用户已经明确希望这次 change 只做最简单的 retention，不引入 progress memo、固定状态字段、resume 恢复或多 agent 复杂度。

本次设计参考 `claude-code` 的 invoked-skill retention 思路，重点参考以下文件：

- `~/Documents/code/codex/claude-code/src/bootstrap/state.ts`
- `~/Documents/code/codex/claude-code/src/services/compact/compact.ts`
- `~/Documents/code/codex/claude-code/src/tools/SkillTool/SkillTool.ts`

但当前项目和 `claude-code` 有一个重要差异：本项目是 web 服务，且会完整持久化 session messages；当前也没有通用 attachment/resume 恢复链路。因此本 change 不必照搬 `claude-code` 的内存态 invoked-skill registry，可以直接从持久化消息重建 retention，减少实现面。

## Goals / Non-Goals

**Goals:**
- 在 session 级别保留真正已调用 skill 的 canonical content，使其在 compact 后仍能重新进入模型上下文。
- 将 skill retention 与通用摘要分离，避免把 skill 内容塞进 summary 文本。
- 只保留同一 session 下每个 skill 的最新成功版本，控制复杂度。
- 为 retention 提供显式诊断日志，便于确认“有没有提取出来、有没有注回、为什么跳过”。
- 保持实现与当前 `agent-backend` 架构兼容，不引入 resume、attachment 持久化或新的 provider 抽象。

**Non-Goals:**
- 不保留 skill 工作进度、known facts、next action 等 progress memo。
- 不为不同 skill 定义专门状态机或可扩展状态字段。
- 不把 skill listing、discovery、candidate recommendation 纳入 retention。
- 不处理进程重启后的恢复或 session resume 链路。
- 不引入多 agent retention 隔离设计；本 change 仅按现有 session 作用域工作。

## Decisions

### Decision: 以持久化 session messages 为来源重建 retained skills，而不是新增独立 runtime registry

retention 数据直接从当前 session 的已持久化消息中提取，不新增单独的进程内 invoked-skill registry。提取来源限定为成功的 `skill:skill` 工具消息，按 skill 名称去重，只保留最新一份 content。

Rationale:
- 当前仓库已经持久化完整消息，历史 skill content 并未物理丢失。
- 这样可以减少一个新的状态面，避免再处理 registry 生命周期、resume 补写和跨请求同步。
- 这也回应了当前服务形态下最直接的问题：已有消息能否被重新组织成独立 retention 提醒。

Alternatives considered:
- 完全照搬 `claude-code`，新增独立内存态 `invokedSkills` registry。

Why not:
- 对当前服务来说是额外复杂度，且当前没有 resume attachment 基础设施去消费这套状态。

### Decision: retention 只识别成功的 `skill:skill` 调用，不包含 listing、discovery 或失败调用

只有成功加载 canonical skill content 的 `skill:skill` 调用才进入 retention。`skill` listing/discovery 提醒、planner 候选 skill、失败的 `skill:skill`、以及未伴随 canonical content 的其他 skill 相关信号都不进入 retention。

Rationale:
- 这条 change 的目标是“保住已调用 skill 的说明书”，不是保住候选技能列表。
- 限定在成功的 `skill:skill` 可以直接复用现有工具输出，不需要为其他调用路径重新推导 content。

Alternatives considered:
- 把 `skill:exec` 也作为 retention 来源，或把 skill listing 一起保留。

Why not:
- `skill:exec` 不一定天然携带完整 skill content，会扩大实现范围。
- listing/discovery 属于其他 change，混入会导致边界漂移。

### Decision: 在 compact 后注入单独的 retained-skill reminder message，而不是把内容写进 summary

`ContextManager` 在存在 summary 且提取到 retained skills 时，额外注入一条独立的 runtime-only reminder message。该消息使用固定结构包装 retained skills，和 `【会话摘要】` 分离。

建议格式：

```text
【已调用技能保留】
<invoked_skills>
<skill name="...">
...
</skill>
</invoked_skills>
```

Rationale:
- 这样可以让 summary 继续只表达“任务摘要”，而 skill retention 单独表达“仍然有效的 canonical instructions”。
- 当前项目没有通用 attachment 消息类型；使用 runtime-only synthetic message 是最小改动。
- 该行为目标仍与 `claude-code` 一致，即在 compact 后显式补回 invoked skill content。

Alternatives considered:
- 把 skill 内容压进通用 summary。
- 引入新的持久化 attachment 消息类型。

Why not:
- 写进 summary 会污染摘要职责，也难以控制格式和预算。
- 新 attachment 类型会牵动 session message schema、前端读取和 resume 路径，超出本 change 范围。

### Decision: retention 受 dedicated budget 控制，并在超预算时显式记录跳过日志

retained-skill reminder 使用独立预算，不与 summary 文本混算。预算不足时，按“同 skill 最新优先、整体最新优先”的顺序保留能装下的 skill，并为被跳过的 skill 记录日志。

Rationale:
- skill content 可能很长；无上限回注会直接破坏 context budget。
- 这是一个必要但必须显式的边界规则，日志能保证问题暴露而不是静默降级。

Alternatives considered:
- 无预算上限，全部回注。
- 超预算时把 skill 内容改写成更短的模型摘要。

Why not:
- 无上限不可控。
- 再摘要一次会把本 change 重新拉回 progress memo / secondary summarization 复杂度。

### Decision: 加入 retention 专项日志，优先支持调试

为 retention 增加至少三类日志：

- `skill.retention.extracted`
- `skill.retention.injected`
- `skill.retention.skipped`

日志至少包含 session 作用域、skill 数量、skill 名称列表、注入字符数或 token 估算、以及跳过原因。

Rationale:
- 这条 change 的主要风险是“逻辑看似存在，但很难确认什么时候生效”。
- 用户已明确希望把日志要求写入 proposal。

Alternatives considered:
- 只依赖已有 `context.*` 或 `skill tool invocation *` 日志。

Why not:
- 现有日志不能直接回答 retention 是否提取、是否注回、为什么没注回。

## Risks / Trade-offs

- [Risk] 由于不做进程重启恢复，服务重启后无法依赖内存态保留历史 retention。
  → Mitigation：本设计直接从持久化 session messages 重建 retained skills，不依赖新增内存 registry。

- [Risk] retained skill content 可能挤占 prompt budget。
  → Mitigation：使用 dedicated budget，并对超预算跳过做显式日志。

- [Risk] 如果 `skill:skill` 输出格式未来变化，提取器可能失效。
  → Mitigation：提取逻辑只依赖工具名、成功状态和原始 output，不依赖对 skill body 做二次语义解析；同时补充针对真实工具输出形状的单元测试。

- [Risk] runtime-only synthetic message 可能与未来 attachment 体系重复。
  → Mitigation：在 design 中明确这只是当前架构下的最小落地形态，未来若有统一 attachment 体系，再独立迁移。

## Migration Plan

1. 新增 retained-skill extractor，从 session messages 中提取同一 session 的最新成功 `skill:skill` 内容。
2. 在 `ContextManager` 的 message-pool 构造阶段加入 retained-skill reminder message，且只在 summary 存在时启用。
3. 为 retention reminder 增加 dedicated budget 和跳过日志。
4. 补充针对 compaction 后上下文构造的单元测试，覆盖：
   - summary 存在时注回
   - 无 retained skills 时不注回
   - 同 skill 多次调用时只保留最新
   - listing/失败调用不进入 retention
5. 补充 retention 专项日志验证。

Rollback strategy:
- 如果实现后效果不稳定，可直接移除 retained-skill extractor 与 reminder 注入逻辑，恢复为现有 summary-only compaction 行为；不涉及数据迁移。

## Open Questions

- 当前没有阻塞 proposal 的开放问题。实现阶段只需要在代码里固定 dedicated budget 的具体数值，并用日志暴露实际命中情况。
