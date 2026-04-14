## Context

The current skill onboarding flow mixes three concerns into one operational chain: canonical package registration, managed governance initialization, and runtime publication. Administrators must add or edit `skills/manifest.json`, place files under an agent-scoped skills path, restart `agent-backend` so the catalog is rebuilt, and then run a separate managed-skill import flow before governance can start.

That model conflicts with the intended operating mode:
- one administrator manages many skills across many agents
- the same canonical skill can be bound to multiple agents
- invalid zip uploads must fail before the package touches runtime storage
- canonical package content and managed governance metadata must stay strictly separate

This change is intentionally limited to canonical ingestion and catalog refresh. It does not redesign the existing managed `生产 / 测试` lifecycle, which is split into a follow-on change so the upload path can land independently.

The design must preserve the current top-level repository structure, keep agent governance authoritative for runtime exposure, and avoid silent fallback behavior. Existing canonical skill packages do not need backward-compatibility treatment; they can be reshaped to the new contract directly.

## Goals / Non-Goals

**Goals:**
- Replace per-skill manifest registration with a shared canonical skill library that is discovered directly from disk.
- Make zip upload the primary admin ingestion path for one canonical skill package at a time.
- Validate uploads before persistence, return structured errors for invalid packages, and block unsafe archives.
- Encode canonical skill identity in `SKILL.md` frontmatter with a required `id`.
- Keep governed display metadata, surface state, starter metadata, and agent bindings entirely outside the canonical package.
- Support in-process catalog reload after upload, overwrite, and delete so administrators do not need to restart the backend.
- Preserve the current managed governance model while replacing the canonical ingestion path.

**Non-Goals:**
- Replace the existing `生产 / 测试` governance lifecycle with `draft / published`.
- Reset managed governance to empty draft defaults after upload or overwrite.
- Preserve compatibility with existing manifest-driven skill package layouts or `SKILL.md` files that do not match the new schema.
- Treat the current repository `apps/agent-backend/assets/**/SKILL.md` conventions as a normative compatibility baseline.
- Restructure top-level monorepo directories.
- Introduce new third-party dependency versions without separate confirmation.

## Decisions

### Decision: The new canonical package contract is authoritative over current repository fixtures

The upload contract defined by this change is the normative source of truth. Existing repository-owned skills under `apps/agent-backend/assets/**` may be inspected and migrated, but they are migration inputs and test fixtures rather than a compatibility baseline. If a built-in skill package conflicts with the new `SKILL.md` / `SCRIPTS.yaml` contract, the repository skill should be reshaped to comply rather than the backend retaining fallback parsing or legacy schema branches.

Alternatives considered:
- Keep legacy parsing paths because current repository skills still use them: rejected because it lets transient repository state define the product contract and expands the ingestion change with avoidable compatibility debt.

### Decision: Separate canonical package identity from managed governance completely

Canonical package metadata will live only in `SKILL.md` / `SCRIPTS.yaml`, while managed governance will remain in the managed registry. The canonical frontmatter will require `id`, `name`, and `description`. Managed fields such as `displayName`, `displayDescription`, `surface`, `agentBindings`, `starterEnabled`, and `starterSummary` will never be written back into the package.

This keeps zip uploads self-describing and removes the current ambiguity where canonical values are copied into governed values during import.

Alternatives considered:
- Keep `skillId` in `skills/manifest.json`: rejected because it forces a second registration step outside the package.
- Infer `skillId` from directory name or zip filename: rejected because the package would no longer carry its own stable identity.

### Decision: Move canonical skills into a shared skill library and drop per-skill manifest registration

Canonical packages will be stored under a shared library such as `apps/agent-backend/assets/skills/<skillId>/`, while agent definitions stay under `apps/agent-backend/assets/agents/**`. Agent-to-skill availability will be expressed only through managed governance bindings, not by where the package is stored on disk.

This matches the actual product model: many skills per agent and the same skill across multiple agents.

Alternatives considered:
- Keep agent-scoped skill directories and just automate manifest edits: rejected because the filesystem layout would still imply a false single-owner relationship for shared skills.
- Keep `skills/manifest.json` as an optional cache: rejected because it would preserve two sources of truth for canonical discovery.

### Decision: Upload one skill zip at a time through a validate-then-persist pipeline

The admin upload API will accept exactly one zip package. The backend will save it to a temporary location, unpack it into a temporary directory, validate archive safety and skill semantics, and only then move the canonical package into the shared skill library. Validation failures will return structured issues and will not mutate existing canonical or managed data.

Validation must cover:
- archive safety: path traversal, absolute paths, unsupported symlinks, empty archive, multiple skill roots
- package shape: exactly one skill package, required `SKILL.md`
- frontmatter contract: required `id`, `name`, `description`
- script manifest validity when `SCRIPTS.yaml` exists
- canonical identity conflict handling

Alternatives considered:
- Persist first and let startup/catalog load fail later: rejected because failures surface too late and pollute runtime storage.
- Allow batch zip upload with multiple skills: rejected because the admin workflow explicitly wants one skill per upload.

### Decision: Overwrite is explicit and preserves the current managed governance state

If an uploaded package uses an existing canonical `id`, the backend will return a conflict summary that includes the current canonical name, governance surface state, and bound agents. Replacement proceeds only after explicit confirmation. Once confirmed, the canonical package is replaced, canonical metadata is refreshed, and the existing managed governance record remains intact in this change unless an administrator separately edits governance fields.

This lets upload-driven canonical replacement land independently from the later lifecycle redesign, without forcing a larger front-end and runtime behavior cutover in the same change.

Alternatives considered:
- Reset governance immediately on overwrite: rejected for this change because that behavior belongs to the follow-on lifecycle redesign.
- Always reject overwrite: rejected because administrators need a controlled way to revise an existing skill package.

### Decision: Reload the canonical catalog in process after upload, overwrite, and delete

`SkillCatalog` will gain an explicit reload path. Successful upload, overwrite, and delete operations will refresh canonical discovery and then sync the managed registry against the refreshed canonical set before the admin API returns success.

This removes the current restart requirement and keeps runtime skill discovery aligned with administrative changes.

Alternatives considered:
- Require service restart after any canonical change: rejected because it preserves the current operational bottleneck.
- Poll the filesystem asynchronously: rejected because admin actions already provide an explicit lifecycle boundary where reload can happen deterministically.

### Decision: Deleting a skill removes both the canonical package and managed governance

Delete will be a confirmed destructive admin action that removes the canonical package from disk, removes the managed record, reloads the catalog, and makes the skill disappear from all governed runtime surfaces.

Alternatives considered:
- Soft-delete only the managed record: rejected because the canonical package would remain orphaned on disk.
- Force manual unbind before delete: rejected because the system can deterministically clear those bindings as part of the delete action.

### Decision: Preserve the current admin page structure and add the new workflow in place

The web admin experience will stay inside the existing `Skill 管理` screen, preserving the current list-detail layout and the existing governance form sections. Upload, overwrite confirmation, delete confirmation, and structured validation issues will be expressed as inline actions and inline status surfaces on that page rather than through a new route, step-by-step wizard, or separate full-screen flow.

This keeps the front-end impact focused on the management surface that already owns skill governance and avoids unnecessary page-level rewrites while the backend ingestion path changes underneath it.

Alternatives considered:
- Rebuild the page into a multi-step upload wizard: rejected because the workflow change does not require a new information architecture.
- Split upload into a separate dedicated page: rejected because upload, governance editing, and delete decisions all operate on the same managed-skill object and fit the current screen ownership.

## Risks / Trade-offs

- [Overwrite preserves prior governance state] -> Canonical behavior may change while old governance metadata stays attached; expose the conflict summary clearly and defer reset semantics to the lifecycle follow-on change.
- [Upload/delete now mutate runtime assets live] -> Use validate-then-persist, atomic replace/move semantics, and synchronous catalog reload before success responses.
- [Shared skill library changes dist/source path assumptions] -> Update runtime path resolution and tests together so governed script execution resolves the new canonical layout in both source and dist modes.
- [Existing skill packages will need schema updates] -> Treat that as a planned migration, not a compatibility layer; update canonical fixtures and repository packages in the same implementation stream.
- [Zip extraction may tempt a new dependency] -> Prefer existing platform capabilities first; if a new third-party archive dependency is needed, get explicit version confirmation before implementation.
- [The page could grow into a front-end rewrite] -> Keep the existing admin page shell, express conflict/error/confirmation states inline, and avoid solving backend ingestion complexity through new page-level navigation.

## Migration Plan

1. Introduce the new canonical skill package schema with required `id`, `name`, and `description`.
2. Move canonical skills into the shared skill library layout and remove per-skill manifest discovery from `SkillCatalog`.
3. Add upload, overwrite-confirmation, delete, and reload-backed admin APIs.
4. Update managed registry sync behavior so upload-backed canonical packages create or refresh managed records without manifest import while preserving the current governance fields on overwrite.
5. Incrementally extend the existing admin UI from manual import to upload/overwrite/delete within the current list-detail page structure and inline editing model.
6. Refresh tests and fixtures around canonical package validation, runtime reload, overwrite preservation, and delete behavior.

Rollback strategy:
- Restore manifest-driven discovery and the previous canonical asset layout from version control.
- Disable the upload/delete admin endpoints and revert the admin UI to the prior import flow.

## Open Questions

- None at proposal time; the upload, overwrite, deletion, reload, and schema choices are already decided for this change.
