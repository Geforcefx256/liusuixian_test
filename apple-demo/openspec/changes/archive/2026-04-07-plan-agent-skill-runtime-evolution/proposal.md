## Why

当前围绕 `agent-backend` skill 系统演进已经形成多组候选 change，但这些候选项混用了不同拆分轴，存在明显重叠：有的按元数据/运行时/压缩链路拆，有的按风险级别拆，还有的把 listing、条件激活、权限边界混在一起。继续直接展开 proposal，会让后续 change 在边界、依赖和验证面上持续漂移。

这份 umbrella planning change 已经完成了它的主要职责：前三个 follow-on changes 已分别落地并归档，剩余两个 runtime 方向的 change 也已经被明确决定暂不推进。现在需要刷新这份 planning artifact，让它准确反映当前序列的实际结果，而不是继续保留一份过期的“待实施清单”。

## What Changes

- Refresh the umbrella planning change so it records the realized outcome of the sequence rather than an all-pending plan.
- Record the three completed and archived follow-on changes:
  - `skill-metadata-foundation`
  - `skill-discovery-and-listing`
  - `skill-state-retention`
- Record that `skill-invocation-policy` and `skill-runtime-overrides-and-forking` are explicitly deferred and are not part of the current sequence closure.
- Preserve the deferred status of `skill-source-layering-and-dedup` and `provider-abstraction`.
- Preserve the hard non-regression constraint that governed `skill:exec` must remain a real execution path rather than degrading into a pure prompt-only fallback.
- Make the planning change archive-ready once the refreshed artifacts are in sync with repo reality.

## Capabilities

### New Capabilities
<!-- None. This umbrella change records staged planning and boundaries only. -->

### Modified Capabilities
<!-- None. This umbrella change does not directly modify capability requirements. -->

## Impact

- `openspec/changes/plan-agent-skill-runtime-evolution/` planning artifacts only in this change.
- The completed follow-on changes already landed in archived change directories and corresponding runtime code paths.
- No new runtime behavior is introduced by this refresh.
- No third-party dependency change is proposed in this planning change.
- No top-level directory restructuring is proposed in this planning change.
