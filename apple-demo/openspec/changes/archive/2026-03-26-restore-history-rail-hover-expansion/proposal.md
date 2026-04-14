## Why

The current left history rail no longer matches the intended workbench interaction model. Instead of expanding when the pointer enters the left rail area, the Vue implementation requires an explicit click on `历史会话` and then opens a separate overlay panel. That changes the feel of the shell from the `index-v10.html` pattern the product was originally designed around.

This needs to be corrected now because the current click-to-open behavior is not just a visual variation. It changes the product contract of the left rail, teaches users the wrong interaction, and is already reinforced by component tests. If it stays in place, later shell refinements will be built on a behavior the product owner does not actually want.

## What Changes

- Restore the left history rail to a collapsed-by-default, hover-triggered expansion model aligned with `index-v10.html`.
- Make the expansion trigger the entire left rail region rather than a dedicated click-only `历史会话` toggle.
- Keep the expanded history surface as an overlay-style panel that does not change the in-flow width of the main workbench layout while it opens.
- Ensure pointer exit closes the expanded history surface when the user leaves both the collapsed rail and the expanded panel region.
- Keep session selection, search, preview text, and deletion inside the expanded rail surface, but remove the assumption that clicking is required to open it.
- Update tests and workbench requirements so the intended hover-expansion contract is explicit and no longer conflicts with implementation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: revise the history-rail interaction requirements so the left session rail expands on hover from the rail region, preserves preview-rich overlay behavior, and keeps click reserved for session actions rather than rail expansion.

## Impact

- Affected frontend code in `apps/web`, especially `SessionRail.vue`, `WorkbenchShell.vue` only if integration behavior needs adjustment, and related component tests.
- Affected workbench interaction requirements in `openspec/specs/agent-web-workbench/spec.md`, because the current spec language does not clearly preserve the original hover-triggered rail contract.
- No backend API changes are expected for this correction.
