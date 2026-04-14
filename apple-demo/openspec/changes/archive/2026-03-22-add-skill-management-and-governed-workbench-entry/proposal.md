## Why

The current system treats imported skills as immediately visible and agent-bound once they appear in the static asset catalog, which makes production skills, experimental skills, and homepage starter entries indistinguishable. We need a governed skill management layer now so the core-network workbench can expose only approved skills to end users, keep `SKILL.md` files in a standard format, and project the homepage around real core-network workflows instead of raw asset order.

## What Changes

- Introduce a managed skill registry and administration flow that imports standard skills, stores governance policy outside `SKILL.md`, and controls whether a skill is production or experimental.
- Add a dedicated admin skill-management surface, entered from the workbench header management entry, where administrators import standard skills, govern user-visible descriptions, and configure surface policy without exposing raw skill content to end users.
- Add system-managed bindings that decide which agents can load which governed skills and which user-visible descriptions are exposed without revealing raw skill content.
- Update agent runtime skill loading so agent metadata, skill execution, and skill-tool availability are resolved from governed skill policy rather than directly from the raw asset catalog.
- Update the workbench home experience so starter entries and skill search are projected from the governed, user-visible skill surface for the active agent.
- Reframe the workbench starter framework around the core-network task groups of planning, configuration authoring, data transformation, and verification, with `dpi-new-bwm-pcc` representing the primary planning entry for the formal surface.
- Hide experimental and test-only skills from the production workbench surface by default while keeping them governable through the admin module.

## Capabilities

### New Capabilities
- `skill-management`: Govern imported standard skills through managed records, agent bindings, visibility policy, and production versus experimental surface control.

### Modified Capabilities
- `agent-backend-runtime`: Runtime skill discovery and execution requirements will change so agents and tools only expose governed skills that are approved for the current surface.
- `agent-web-workbench`: Home-stage starter entries and skill discovery requirements will change so the UI reflects governed skill visibility and the core-network starter framework.

## Impact

- Backend runtime catalog, bootstrap payloads, agent detail APIs, and skill tool authorization
- New skill management backend APIs and persistence for managed skill records, bindings, and visibility policy
- Workbench home-stage IA, starter cards, skill search, header navigation, and agent-facing skill metadata
- Admin-facing UI for importing, governing, and binding skills without exposing raw `SKILL.md` bodies to end users
- Production workbench discovery rules so end users see governed descriptions only, while experimental skills remain off the default core-network surface
