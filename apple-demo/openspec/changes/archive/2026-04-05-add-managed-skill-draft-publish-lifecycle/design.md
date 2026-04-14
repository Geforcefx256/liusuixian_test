## Context

After `streamline-skill-upload-governance`, canonical skill packages can enter the system through direct upload, overwrite, delete, and in-process catalog reload. That solves the operational onboarding path, but it intentionally preserves the existing managed `生产 / 测试` governance semantics so the ingestion change can land independently.

The remaining problem is lifecycle clarity:
- an uploaded skill should not be treated as production-ready merely because its canonical package now exists
- an overwritten skill should not silently keep stale governed metadata and bindings
- governed runtime visibility should depend on explicit publication, not on a legacy surface toggle that mixes staging and release intent

This change assumes the upload-driven ingestion path and shared canonical skill library already exist. It focuses only on managed governance lifecycle and the governed runtime projection derived from that lifecycle.

## Goals / Non-Goals

**Goals:**
- Replace the current managed `生产 / 测试` surface policy with explicit `draft / published` lifecycle states.
- Reset upload-created and overwrite-replaced managed skills to clean `draft` defaults.
- Require completed governance metadata and at least one binding before publication.
- Expose only `published` and bound skills through governed runtime metadata and execution surfaces.
- Preserve the current `Skill 管理` page structure and express the lifecycle workflow inline.
- Preserve the current `Skill 管理` visual styling and layout density, limiting frontend changes to lifecycle labels, status affordances, blockers, and warnings.

**Non-Goals:**
- Redefine zip upload transport, archive validation, or canonical shared-library layout.
- Reintroduce manifest-driven canonical discovery.
- Add admin-only draft execution, preview, or trial-run paths in this change.
- Introduce a new route, wizard, or page-level information architecture for skill governance.
- Treat current repository `apps/agent-backend/assets/**/SKILL.md` conventions as the normative baseline for lifecycle behavior or compatibility.

## Decisions

### Decision: Lifecycle state is explicit and independent from canonical package presence

Canonical package presence on disk means the system knows about that skill package. It does not mean the skill is approved for governed runtime exposure. Managed records will therefore carry an explicit lifecycle state of `draft` or `published`, and runtime visibility will depend on that state together with agent bindings.

Alternatives considered:
- Keep `生产 / 测试` surface toggles and reinterpret them: rejected because the legacy labels still blur the difference between unreviewed uploads and deliberately hidden governed skills.
- Infer publication state from whether managed metadata is complete: rejected because publication needs to remain an explicit administrative action.

### Decision: Lifecycle rules are defined by managed governance, not by current repository skill package conventions

This change will not preserve or derive lifecycle semantics from the current `apps/agent-backend/assets/**/SKILL.md` conventions. Existing repository-owned skills may be migrated as needed, but they are migration inputs rather than design anchors. The authoritative contract is the managed registry schema, admin payloads, and runtime visibility rules defined by this change.

Alternatives considered:
- Keep lifecycle behavior partially coupled to current built-in skill metadata so repository fixtures continue to work unchanged: rejected because it lets historical package conventions drive governance semantics and weakens the `draft / published` cutover.

### Decision: Upload and overwrite reset managed skills to clean draft defaults

When upload creates a managed record or overwrite replaces an existing canonical package, the managed record will be rebuilt in `draft`. Governed display name, governed display description, starter summary, starter enablement, starter grouping, starter priority, and agent bindings will be cleared so the administrator must review and republish the new package deliberately.

Alternatives considered:
- Preserve prior governance across overwrite: rejected because it can attach stale governed policy to materially changed canonical behavior.
- Copy canonical metadata into governed fields on upload reset: rejected because it hides the distinction between canonical package content and reviewed governed presentation.

### Decision: Publication requires completed governance and bindings

A managed skill may become `published` only after the administrator supplies a non-empty governed display name, a non-empty governed display description, and at least one bound agent. If any prerequisite is missing, the record remains in `draft`.

Alternatives considered:
- Allow publishing with only bindings or only display fields: rejected because end-user runtime surfaces require both governed presentation and an explicit availability scope.
- Auto-publish new uploads: rejected because upload is an ingestion step, not a publication decision.

### Decision: Governed runtime projection is published-only

Agent detail, bootstrap metadata, planner candidate selection, and governed execution authorization will all treat `published + bound` as the visibility rule. `draft` skills remain administratively manageable but must not appear in governed runtime surfaces.

Alternatives considered:
- Expose `draft` skills to runtime but hide them in the UI: rejected because it would break the guarantee that managed governance is authoritative for runtime exposure.
- Keep runtime authorization on legacy `production / experimental` while only changing the admin UI labels: rejected because the lifecycle cutover must remain behaviorally real, not cosmetic.

### Decision: Preserve the current admin page structure and adapt lifecycle controls in place

The web admin experience will remain inside the existing `Skill 管理` screen. The current list-detail layout and governance sections stay in place, while the page replaces `生产 / 测试` controls with `draft / published` lifecycle controls, shows publish blockers inline, and warns clearly when overwrite reset clears prior governance state.

Alternatives considered:
- Rebuild the page into a lifecycle wizard: rejected because the workflow still belongs to the current governance screen.
- Move publication into a separate page: rejected because upload, governance editing, binding, and publication all operate on the same managed-skill object.

## Risks / Trade-offs

- [Overwrite intentionally discards prior governance state] -> Make the reset warning explicit before confirmation and keep the cleared fields visible after reset.
- [Persisted records need lifecycle migration] -> Map existing `production` records to `published` and `experimental` records to `draft`, then persist in the new schema.
- [Frontend and runtime currently infer visibility from legacy surface labels] -> Update types, payloads, and governed visibility logic together in the same implementation stream.
- [Draft reset can surprise administrators after replacing a package] -> Present the reset as an explicit lifecycle boundary rather than a silent side effect.

## Migration Plan

1. Add explicit managed lifecycle status with persistence migration from `production / experimental` to `draft / published`.
2. Update upload and overwrite flows so managed records reset to clean `draft` defaults.
3. Update runtime/bootstrap/planner/tool authorization so only `published` and bound skills remain visible in governed runtime surfaces.
4. Update the existing admin UI and frontend contracts to use lifecycle status instead of legacy surface labels.
5. Refresh tests around migration, overwrite reset, publish prerequisites, and published-only runtime visibility.

Rollback strategy:
- Restore the previous managed surface policy fields and mapping from version control.
- Revert runtime visibility checks and admin UI controls back to the prior `生产 / 测试` model.

## Open Questions

- None at proposal time; this change is intentionally scoped to the lifecycle redesign that was split out of `streamline-skill-upload-governance`.
