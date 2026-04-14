## Context

The current left history rail has diverged from the original workbench interaction model. The Vue implementation requires an explicit click on `历史会话` to reveal an expanded history panel, and the associated component tests now enforce that click-first behavior. That is inconsistent with both the intended product direction and the `index-v10.html` reference, where the left rail is collapsed by default and expands when the pointer enters the rail region.

There is also a second constraint that matters now: the workbench shell has evolved beyond the original static prototype. It now contains a central conversation surface, an optional workspace editor pane, a persistent right workspace sidebar, and desktop resize behavior. Reintroducing hover expansion by literally widening the left rail in flow would risk disturbing the current pane-allocation logic more than necessary.

This design therefore needs to preserve the intended interaction model without destabilizing the broader shell.

## Goals / Non-Goals

**Goals:**
- Restore the left history rail to a hover-triggered expansion model.
- Treat the whole collapsed rail region as the expansion hotspot, not a click-only button.
- Keep the expanded history surface preview-rich, searchable, and destructive-action capable.
- Preserve stable workbench layout geometry while the history rail expands.
- Ensure the hover-expansion contract is explicit enough to be tested and hard to regress accidentally.

**Non-Goals:**
- Redesign the visual language of the left rail beyond what is needed to support the restored interaction.
- Change backend session APIs, preview payload shape, or deletion flow.
- Rework the session rail into a permanently expanded column.
- Change the right workspace sidebar or center editor behavior in this change.

## Decisions

### Decision: Expansion trigger is the rail region, not a discrete toggle action

The collapsed left rail will open when the pointer enters the rail region, rather than only when the user clicks a dedicated `历史会话` toggle. Session item clicks inside the rail remain session actions, not rail-open actions.

Rationale:
- This matches the original product intent and the `index-v10` interaction model.
- It keeps the collapsed rail feeling like a navigational edge rather than a button that launches a separate dialog.
- It reduces one extra click for a high-frequency navigation surface.

Alternatives considered:
- Keep explicit click-to-open: rejected because it is the behavior the product owner has already identified as incorrect.
- Expand only when hovering a specific history icon: rejected because it makes the trigger too precise and breaks the edge-of-shell affordance the rail is meant to provide.

### Decision: Expanded history remains overlay-based rather than widening the in-flow rail

The expanded history surface will continue to open as an overlay panel adjacent to the collapsed rail instead of increasing the in-flow width of the left layout column.

Rationale:
- The current workbench shell already coordinates session rail width, conversation width, workspace editor width, and right sidebar width.
- Keeping the expansion overlay-based preserves the intended hover interaction without forcing the main shell to relayout whenever the pointer enters or leaves the rail.
- This stays aligned with the current spec direction that hover expansion must not change the in-flow width of the main layout.

Alternatives considered:
- Literally widen the left rail on hover as in the static prototype: rejected because the current product shell is more complex than the prototype and would be more fragile under repeated hover-driven relayout.
- Keep click-to-open overlay because overlay is already implemented: rejected because the geometry is acceptable, but the trigger model is not.

### Decision: Collapse is governed by leaving the combined hover zone

The expanded panel will stay open while the pointer remains over either the collapsed rail or the expanded overlay panel, and it will close when the pointer leaves both regions. Keyboard-accessible focus handling can preserve the open state while the user is interacting within the panel.

Rationale:
- This avoids flicker when moving from the collapsed rail into the expanded content.
- It preserves usability for search, selection, and deletion controls inside the expanded panel.
- It gives the rail a single mental model: enter to open, leave to dismiss.

Alternatives considered:
- Close immediately when leaving the collapsed rail only: rejected because it would cause accidental dismissal while moving into the expanded panel.
- Require explicit close even in hover mode: rejected because it keeps the wrong interaction burden for a hover-driven shell edge.

### Decision: Tests and specs must describe hover as the governing contract

The component tests and OpenSpec requirement language will be updated so the normative behavior is “hover opens, leaving closes, click selects or deletes” rather than “click opens.”

Rationale:
- The current regression happened partly because tests encoded the wrong product contract.
- Updating implementation without updating tests and specs would leave the project vulnerable to reintroducing the same mistake later.

Alternatives considered:
- Fix only the component behavior and leave the tests/spec wording mostly implicit: rejected because the current mismatch shows that implicit intent is not durable enough.

## Risks / Trade-offs

- [Hover-driven UI can feel brittle if the exit boundary is too narrow] -> Mitigation: treat the collapsed rail and expanded overlay as one combined hover zone.
- [Hover-only patterns can become less obvious for some users] -> Mitigation: preserve visible collapsed rail affordances and keyboard-focus support for the expanded panel.
- [Overlay expansion may still feel less “physical” than the original prototype width-growth] -> Mitigation: keep the directional alignment and content density of the `index-v10` rail while prioritizing shell stability.
- [Tests may become more timing-sensitive if implemented with delayed open/close behavior] -> Mitigation: prefer a deterministic event model unless a delay is clearly needed for usability.

## Migration Plan

1. Update the `agent-web-workbench` delta spec so hover-triggered history expansion is explicit.
2. Refactor `SessionRail.vue` to move from click-governed expansion state to hover-zone-governed expansion state.
3. Update component tests to encode hover-open and leave-close behavior rather than explicit toggle behavior.
4. Verify the expanded overlay still preserves session search, preview, selection, and deletion interactions without changing the shell layout width.

Rollback strategy:
- If hover behavior proves too unstable in practice, keep the overlay geometry but temporarily add a guarded explicit-open fallback while the interaction is redesigned.

## Open Questions

- Should the hover expansion open immediately or after a short dwell delay to reduce accidental triggering?
- Should touch devices fall back to explicit tap-to-open behavior, or is the current desktop-focused workbench allowed to defer that concern?
