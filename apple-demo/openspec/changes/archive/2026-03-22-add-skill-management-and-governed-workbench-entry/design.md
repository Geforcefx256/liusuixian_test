## Context

The current runtime loads skills directly from static asset manifests and exposes those skills to agent metadata, runtime tool selection, and the workbench home stage as soon as they are present in the catalog. That model is too coarse for the intended product direction: the workbench is a core-network configuration assistant, some imported skills are experimental or test-only, and end users should only see governed descriptions rather than raw `SKILL.md` bodies.

This change introduces a managed skill governance layer between canonical skill packages and product surfaces. The canonical skill package remains the source of execution truth, but the managed registry becomes the source of product truth for visibility, agent binding, starter projection, and formal versus experimental rollout.

Stakeholders:
- Product/admin users who import and govern standard skills
- Runtime services that must only load approved skills for the current agent surface
- End users who should discover governed skills through the workbench without seeing raw skill content

## Goals / Non-Goals

**Goals:**
- Preserve `SKILL.md` as a standard capability package format without adding product-surface fields.
- Introduce a skill management model that imports standard skills into managed records with system policy, agent bindings, and formal versus experimental surface control.
- Make agent metadata, runtime skill execution, and skill-tool exposure resolve from managed policy rather than raw asset presence alone.
- Rebuild the workbench starter framework around governed core-network task groups: planning, configuration authoring, data transformation, and verification.
- Ensure end users can only see governed skill descriptions and use approved skills, not inspect raw skill bodies.
- Provide an admin-facing management entry and governed skill management surface that is clearly separated from the end-user workbench task flow.

**Non-Goals:**
- Redesign the underlying canonical `SKILL.md` package structure.
- Expose skill body contents, scripts, or tool wiring to end users.
- Generalize the first workbench entry framework for non-core-network product domains.
- Replace the existing planner/build execution model or file-workspace model.

## Decisions

### Decision: Split canonical skill assets from managed skill governance

The raw asset catalog will remain the canonical source for standard skill packages, but a new managed skill registry will become the runtime and UI source for governed availability. This keeps skill authoring standardized while allowing the product to decide which imported skills are production-ready, experimental, bound to a given agent, and visible to a given user surface.

Alternatives considered:
- Add surface fields directly to `SKILL.md`: rejected because it pollutes the standard package format with product-specific policy.
- Continue using static manifests only: rejected because manifests cannot express formal versus experimental rollout, user visibility, or governed starter behavior.

### Decision: Make skill management skill-centric and agent consumption agent-centric

Governance will be administered as managed skill records first, then projected into agent-specific skill surfaces through bindings and policy filters. This allows one imported skill to be approved for one agent, hidden from another, or withheld from end users without duplicating the canonical package.

Alternatives considered:
- Agent-only configuration of skills: rejected because it spreads governance decisions across each agent surface and makes skill lifecycle management harder to audit.

### Decision: Keep user-facing skill discovery description-only

The managed registry will expose a curated display layer to the workbench and search surfaces: name, governed description, grouping, and starter eligibility. Raw skill body content remains accessible only to runtime services and administrators with governance access.

Alternatives considered:
- Let end users browse imported skill bodies: rejected because it exposes internal execution instructions and breaks the desired assistant-product abstraction.

### Decision: Put skill governance behind a dedicated admin surface

Skill governance will be entered from a dedicated management entry in the workbench header and will open a distinct admin surface for skill list, governance detail, and agent binding operations. This keeps system-governance tasks separate from the core-network workbench flow used by end users.

Alternatives considered:
- Put skill management inside the end-user starter area: rejected because it mixes governance actions with task execution entry points.
- Hide skill management only inside a generic user dropdown: rejected for the first iteration because governance actions need a clear and explicit admin entry.

### Decision: Project the home stage from governed core-network intent groups

The workbench home stage will use fixed intent groups for the target domain: planning, configuration authoring, data transformation, and verification. Each group may show one representative managed skill for the current agent surface, while search covers the wider visible managed skill set.

Alternatives considered:
- Use raw skill ordering for homepage cards: rejected because it is unstable and does not reflect the product workflow.
- Derive intent groups from free-text skill descriptions: rejected because it is too brittle for a governed production surface.

### Decision: Treat test skills as experimental surface content by policy

The formal workbench surface is intended for core-network configuration work. Skills that exist only for testing or experimentation, such as unrelated content-generation demos, will remain imported and governable but will be withheld from the production starter framework and default skill discovery unless policy explicitly exposes them.

Alternatives considered:
- Let all imported skills appear in production search by default: rejected because it weakens trust in the workbench as a focused core-network tool.

### Decision: Apply policy before runtime skill execution and skill-tool exposure

Runtime agent detail payloads, planner candidate skills, and `skill:skill` tool availability must all resolve from the governed skill surface, not the raw asset catalog. This ensures experimental skills remain invisible and unusable for end users even if their canonical packages are imported on disk.

Alternatives considered:
- Filter only in the UI: rejected because hidden skills would still be callable in runtime paths.

## Risks / Trade-offs

- **Governed registry becomes a new source of truth** → Mitigation: keep canonical package import and managed record state explicitly linked so administrators can trace every managed record back to its source skill.
- **Policy and runtime can drift if not enforced consistently** → Mitigation: require bootstrap, agent detail, planner candidate selection, and skill-tool authorization to consume the same governed skill surface.
- **Homepage starter framework may feel sparse when a core-network intent group lacks a representative skill** → Mitigation: allow the group to render a governed discovery fallback instead of forcing a misleading representative skill.
- **Admin complexity increases with bindings and user visibility rules** → Mitigation: keep the first version centered on production versus experimental surface control and agent bindings, with user-level visibility layered on top of the same managed records.
- **Admin and end-user surfaces could drift visually or semantically** → Mitigation: keep the admin area focused on governance tasks while letting the workbench home stage consume only the managed projection of those decisions.

## Migration Plan

1. Introduce managed skill persistence and import flow alongside the existing raw asset catalog.
2. Populate managed records for currently imported skills and mark only core-network skills as production-visible for the workbench surface.
3. Switch agent detail, bootstrap, and skill-tool authorization to consume the governed skill surface.
4. Update the workbench home stage and search to use governed managed skill metadata instead of raw skill arrays.
5. Hide experimental/test skills from production workbench users while preserving admin access for governance.

Rollback strategy:
- Revert runtime resolution and workbench projection to the existing raw asset catalog path.
- Keep canonical skill packages intact so rollback does not require restoring modified `SKILL.md` files.

## Open Questions

- Should the first user-visibility model support only production versus experimental surfaces, or also role-based visibility rules in the same release?
- Does the admin module need version pinning for imported skills immediately, or is single-active-version governance sufficient for the first iteration?
- Should the workbench expose an explicit “more managed skills” drawer on the home stage, or rely on search-only discovery beyond the representative starter cards?
