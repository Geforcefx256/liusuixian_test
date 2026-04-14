## Why

The current skill onboarding flow is too operationally heavy for the intended single-admin workflow. Adding one skill requires manual manifest edits, filesystem conventions, a backend restart, and a separate managed-skill import step before governance can even begin.

This slows down iteration, obscures the boundary between canonical skill packages and managed governance, and makes invalid skill packages fail too late. The backend now needs a direct upload-driven ingestion path that validates one skill package up front, refreshes catalog state without restart, and supports controlled overwrite and delete operations without manual manifest edits.

## What Changes

- Replace skill onboarding through `skills/manifest.json` registration with canonical skill package discovery from a shared skill library directory.
- Introduce an admin upload flow that accepts exactly one skill zip package, validates it before persistence, and rejects invalid packages with structured error details.
- Require canonical `SKILL.md` frontmatter to carry stable package identity through `id`, plus `name` and `description`, while keeping governed display fields outside the canonical package.
- Automatically reload the runtime skill catalog after successful upload, overwrite, or delete operations so administrators do not need to restart `agent-backend`.
- Allow overwrite of an existing canonical skill package after conflict confirmation while preserving the existing managed governance state in this change.
- Allow administrators to delete a managed skill and its canonical package in one confirmed operation, with the runtime removing the skill from all agent surfaces after catalog reload.
- Keep the existing `Skill 管理` information architecture and extend the current list-detail page in place for upload, overwrite confirmation, delete confirmation, and inline validation feedback instead of introducing a new route or wizard flow.
- Preserve the current managed `生产 / 测试` surface policy in this change; explicit `draft / published` lifecycle redesign is intentionally split into a follow-on change.
- Treat the current repository skill packages under `apps/agent-backend/assets/**` as migration inputs rather than a compatibility baseline; the new upload contract is authoritative and repository-owned skills may be reshaped to match it.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: change managed skill ingestion, overwrite, delete, and canonical metadata rules to use single-skill zip upload plus automatic catalog sync instead of manifest-based import, while preserving the current governed surface policy.
- `agent-backend-runtime`: change runtime canonical skill discovery so uploaded and deleted skills become visible after in-process catalog reload without requiring backend restart, while preserving governed runtime approval boundaries.

## Impact

- Affected code: `apps/agent-backend` skill catalog loading, admin skill routes, managed skill registry sync behavior, runtime bootstrap/runtime tool catalog refresh paths, and canonical asset layout under `apps/agent-backend/assets/**`.
- Affected UI/API: admin skill management APIs and the existing `Skill 管理` page flow will shift from manual import to upload/overwrite/delete actions, while preserving the current list-detail layout, inline editing model, and `生产 / 测试` governance controls.
- Data model impact: canonical skill identity moves into `SKILL.md` frontmatter (`id`), while managed governance continues to store display metadata, current surface state, starter settings, and agent bindings separately.
- Operational impact: adding, overwriting, and deleting skills should no longer require editing `skills/manifest.json` or restarting the backend service.
