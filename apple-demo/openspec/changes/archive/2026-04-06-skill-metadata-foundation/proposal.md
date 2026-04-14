## Why

当前 canonical `SKILL.md` 只支持一组很窄的 frontmatter 字段，managed registry、agent detail 和 execution catalog 也只镜像了其中一部分 metadata。这使后续 skill listing、invocation policy、runtime override 等 change 缺少稳定 contract，继续推进会反复在“字段名是什么、默认语义是什么、哪些字段允许进 canonical skill”上重开讨论。

现在需要先完成一层 metadata foundation：把 canonical skill 能表达的字段、统一命名规范、校验规则、默认语义、managed registry 映射和 runtime metadata passthrough 一次定清楚，但不提前让这些字段改变运行时行为。这样后续 change 才能在同一份 contract 上继续演进，而不是边做边改 schema。

## What Changes

- Expand canonical `SKILL.md` frontmatter contract beyond the current required identity fields and examples to cover a unified metadata set for skill expression.
- Standardize new canonical metadata naming under one explicit frontmatter convention, and **BREAKING** stop accepting the previous mixed legacy field names for canonical parsing after this change.
- Define validation and default semantics for required, optional, forbidden, and passthrough-only canonical metadata fields.
- Explicitly forbid governed product-surface metadata such as managed display fields from entering canonical `SKILL.md`; those fields remain managed-registry only.
- Extend the canonical skill catalog and managed registry mirror fields so newly recognized canonical metadata is preserved and synced without mutating governed metadata ownership.
- Expose the expanded canonical metadata through agent detail and execution catalog/runtime metadata surfaces so later changes can consume it without reparsing raw `SKILL.md`.
- Update in-repo canonical skill documents to the new field names so bundled skills remain valid under the new parser contract.
- Keep this change metadata-only: it does not make `allowed-tools`, `user-invocable`, `disable-model-invocation`, `model`, `effort`, or `context` change runtime behavior yet.

## Capabilities

### New Capabilities
<!-- None. This change refines existing skill contracts rather than introducing a separate capability. -->

### Modified Capabilities
- `skill-management`: expand canonical skill metadata contract, managed-registry mirroring, validation, and canonical/governed boundary rules for imported skills.
- `agent-backend-runtime`: expose the expanded governed canonical metadata through agent detail and execution-catalog runtime surfaces without changing runtime policy behavior.

## Impact

- Affected backend code paths:
  - `apps/agent-backend/src/skills/frontmatter.ts`
  - `apps/agent-backend/src/skills/catalog.ts`
  - `apps/agent-backend/src/skills/managedTypes.ts`
  - `apps/agent-backend/src/skills/managedRegistry.ts`
  - `apps/agent-backend/src/skills/managedRegistryStorage.ts`
  - `apps/agent-backend/src/agents/service.ts`
  - `apps/agent-backend/src/agent/types.ts`
- Affected canonical assets:
  - `apps/agent-backend/assets/skills/**/SKILL.md`
- Affected docs/spec artifacts:
  - `openspec/specs/skill-management/spec.md`
  - `openspec/specs/agent-backend-runtime/spec.md`
- The admin skill-management page may need small data-contract display updates, but this change does not propose a frontend layout or visual-style redesign.
- No third-party dependency change is proposed in this change.
- No top-level directory restructuring is proposed in this change.
