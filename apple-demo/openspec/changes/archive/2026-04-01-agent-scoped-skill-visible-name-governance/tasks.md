## 1. Managed Skill Governance Model

- [x] 1.1 Extend managed skill registry types and persistence so agent bindings can store binding-scoped user-visible names while preserving existing canonical skill metadata and global surface policy.
- [x] 1.2 Add migration and load-time normalization from legacy `agentBindings: string[]` records into the new binding structure without losing existing managed skill records.
- [x] 1.3 Enforce governance validation for save/promote flows: user-visible name required per bound agent, default imported names treated as incomplete governance, and uniqueness checked within each agent scope.

## 2. Backend Governed Name Resolution

- [x] 2.1 Update managed skill admin APIs and shared payload types so the frontend can read and persist binding-scoped user-visible names.
- [x] 2.2 Update agent catalog, governed runtime metadata, and bootstrap surfaces to resolve the correct user-visible skill name for the active agent instead of falling back to canonical names.
- [x] 2.3 Update runtime execution metadata so `tool.started` events and completed run skill summaries carry governed user-visible skill names rather than raw `skillId` or canonical skill name.

## 3. Frontend Governance and Workbench Surfaces

- [x] 3.1 Redesign the skill governance detail form to edit `用户可见名称` per bound agent, show incomplete-governance and duplicate-name validation, and preserve the existing `生产 / 测试` workflow.
- [x] 3.2 Update frontend API types, store state, and refresh flows to consume the new binding-scoped governance payloads.
- [x] 3.3 Update starter, search, in-flight assistant headers, and completed assistant summaries so every user-visible skill name slot renders the governed name for the active agent while retaining the `Skill:` mechanism word.

## 4. Verification

- [x] 4.1 Add backend tests covering legacy data migration, agent-scoped uniqueness, incomplete governance blocking production promotion, and experimental skills remaining out of governed runtime surfaces.
- [x] 4.2 Add frontend tests covering per-agent governance editing, active-agent refresh after save, and conversation headers never rendering raw skill identifiers in user-visible surfaces.
- [x] 4.3 Run targeted checks for the touched areas, including backend tests and frontend type/tests needed to verify governed naming consistency end to end.
