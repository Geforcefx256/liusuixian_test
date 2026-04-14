## Why

`streamline-skill-upload-governance` can isolate canonical ingestion, but the managed governance model still uses the legacy `生产 / 测试` surface policy. That legacy model conflates "uploaded but not yet reviewed" with "intentionally hidden from production", and it can preserve prior governed metadata across overwrite of a canonical package.

Administrators need an explicit lifecycle that starts uploaded or replaced skills in a reviewable draft state, requires governance completion before publication, and makes governed runtime visibility depend on that publication state instead of the older surface toggle semantics.

## What Changes

- Replace managed skill lifecycle semantics with explicit `draft` and `published` states.
- Make upload-created and overwrite-replaced managed skills reset to `draft`.
- Clear governed display metadata, starter metadata, and agent bindings when a managed skill is rebuilt through upload or overwrite reset.
- Require non-empty governed display name, governed display description, and at least one bound agent before a managed skill can become `published`.
- Expose only `published` and bound skills through governed runtime metadata, planner candidates, bootstrap payloads, and execution surfaces.
- Update the existing `Skill 管理` page in place to present the `draft -> published` workflow and inline publish blockers without changing the page information architecture.
- Build on the upload-driven canonical ingestion introduced by `streamline-skill-upload-governance`.
- Treat current repository-owned skill packages as migration inputs rather than lifecycle-defining fixtures; lifecycle behavior is governed by managed records and runtime policy, not by legacy `SKILL.md` conventions in `apps/agent-backend/assets/**`.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: replace the current managed `生产 / 测试` surface policy with an explicit `draft / published` lifecycle, including overwrite reset and publish prerequisites.
- `agent-backend-runtime`: change governed runtime visibility so only `published` and bound skills appear in agent metadata, bootstrap payloads, planning, and execution surfaces.

## Impact

- Affected code: `apps/agent-backend` managed skill registry lifecycle, persistence migration, admin skill payloads, bootstrap metadata, planner/runtime authorization, and governed runtime projection.
- Affected UI/API: the existing `Skill 管理` page and frontend managed skill types must shift from `生产 / 测试` terminology to `draft / published` lifecycle controls while keeping the current list-detail layout.
- Data model impact: managed skill records gain an explicit lifecycle status that becomes the authority for governed runtime visibility.
- Sequencing impact: this change assumes upload, overwrite, delete, and catalog reload flows already exist from `streamline-skill-upload-governance`.
