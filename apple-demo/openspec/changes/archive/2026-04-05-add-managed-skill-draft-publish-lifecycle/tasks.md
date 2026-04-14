## 1. Managed Lifecycle Model And Storage

- [x] 1.1 Replace the current managed surface state with explicit `draft / published` status in registry storage, runtime types, admin payloads, and persistence migration, mapping existing `production` records to `published` and `experimental` records to `draft`.
- [x] 1.2 Make upload-created and overwrite-replaced managed skills reset to `draft` with empty governed display metadata, cleared starter metadata, and no agent bindings.
- [x] 1.3 Enforce publish prerequisites for governed display name, governed display description, and at least one bound agent.

## 2. Runtime Projection And Frontend Contract

- [x] 2.1 Update bootstrap metadata, agent detail, planner candidate selection, and runtime skill/tool authorization so only `published` and bound skills appear in governed runtime surfaces.
- [x] 2.2 Update frontend API/types/store contracts to consume managed skill lifecycle status instead of legacy `生产 / 测试` surface labels where governed visibility depends on lifecycle.

## 3. Admin UI And Verification

- [x] 3.1 Adapt the existing `Skill 管理` page from `生产 / 测试` toggles to `draft / published` lifecycle controls within the current list-detail layout.
- [x] 3.2 Add inline publish blockers and overwrite-reset warnings that explain cleared governance state and required publication fields.
- [x] 3.3 Add or update backend and frontend tests covering lifecycle migration, upload/overwrite reset, publish prerequisites, and published-only runtime visibility.
