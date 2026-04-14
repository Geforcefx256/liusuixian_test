## Context

The workbench already distinguishes richer assistant surfaces such as protocol cards, rich result cards, error cards, and pending interaction UI. What remains visually weak is the plain assistant text path: completed assistant text messages are rendered as preserved newline text inside a normal chat bubble, which makes headings, lists, and code-fence replies look like raw markdown rather than intentional reading surfaces.

The user has explicitly narrowed the first release:

- only assistant plain-text messages
- only after the message is complete
- a low-profile manual toggle near the timestamp
- no preference persistence across refreshes
- no backend message-shape changes

This creates a strong implementation constraint and an opportunity at the same time: the frontend already owns the plain assistant bubble presentation, and the repo already has a controlled markdown renderer for workspace preview. The change can therefore stay inside the frontend message layer if the design keeps scope narrow.

## Goals / Non-Goals

**Goals:**
- Improve readability for completed assistant plain-text messages that contain strong structured-text signals.
- Keep short conversational assistant replies in the existing bubble-style presentation by default.
- Allow a per-message manual switch between rendered reading mode and raw text.
- Keep the first release frontend-only with transient local state.
- Reuse the existing controlled markdown rendering approach instead of introducing a new rich-text dependency.

**Non-Goals:**
- Changing backend message contracts, persisted message kinds, or runtime output semantics.
- Persisting per-message reading-mode preferences across refreshes, session switches, or history reload.
- Applying this presentation model to protocol, result, error, or user-authored messages.
- Building a full document-view page, side panel, or editor-like reader for assistant content.
- Supporting the entire markdown ecosystem in the first release beyond the current controlled subset.

## Decisions

### Decision: Restrict reading mode to completed assistant plain-text messages

The workbench SHALL only evaluate reading-mode eligibility for assistant messages whose frontend type is plain text and whose display status is complete.

Rationale:
- This preserves clean boundaries with existing protocol, result, and error surfaces.
- Streaming messages are unstable and would cause presentation churn if they reflowed mid-generation.
- User-authored messages should remain chat-like even if they contain markdown syntax.

Alternatives considered:
- Apply the same logic to all message kinds: rejected because structured message kinds already have dedicated rendering contracts.
- Reclassify streaming messages live: rejected because bubble-to-document transitions during streaming would be visually noisy.

### Decision: Use conservative frontend heuristics for default eligibility

The first release SHALL classify eligible messages through conservative frontend heuristics rather than backend hints or model-generated metadata.

Recommended heuristic signals:
- strong structural markers such as code fences, markdown headings, or multi-item lists
- longer multi-paragraph text with explicit blank-line separation
- length thresholds only as supporting signals, not as the sole decision rule

Rationale:
- The user wants a small change and does not require backend support.
- Plain text already exists in frontend state, so heuristic evaluation is cheap and local.
- Conservative heuristics reduce false positives on short conversational replies such as follow-up questions or acknowledgements.

Alternatives considered:
- Length-only classification: rejected because many short structured replies still benefit from reading mode, and many long conversational replies should stay bubble-like.
- Backend-provided message classification: rejected because it would expand the message contract for a presentational concern that can be handled locally.

### Decision: Treat manual override as transient per-message frontend state

The manual `阅读 / 原文` switch SHALL be modeled as transient per-message frontend state keyed to the displayed message identity and SHALL NOT be persisted to backend session history.

Rationale:
- The user explicitly does not want the preference remembered.
- This aligns with the existing pattern of frontend-owned overlay state for assistant presentation concerns.
- A per-message override is more precise than a conversation-wide mode because message shapes vary heavily within the same session.

Alternatives considered:
- Global conversation-level toggle: rejected because it would over-apply reading mode to short chat replies.
- Persisted per-message preference: rejected because it increases implementation scope without solving a core user problem.

### Decision: Reuse the controlled markdown renderer but introduce conversation-scoped reading styles

The reading-mode body SHALL reuse the existing controlled markdown rendering pipeline, but it SHALL render through conversation-specific styles instead of inheriting the workspace document preview surface wholesale.

Rationale:
- The current markdown preview implementation already escapes raw HTML and supports the subset needed for headings, lists, links, quotes, and code fences.
- Conversation reading mode needs tighter typography and spacing than workspace document preview.
- Reuse avoids adding a third-party markdown library for a narrow first release.

Alternatives considered:
- Render raw HTML from a full markdown library: rejected because it expands security and maintenance surface.
- Reuse the workspace markdown preview component unchanged: rejected because workspace document styling is too page-like for an inline conversation message.

### Decision: Show the toggle only when the message is meaningfully switchable

The workbench SHALL show the low-profile manual switch only for completed assistant plain-text messages that the frontend considers reading-mode eligible.

Rationale:
- A toggle on every assistant message would add noise to the conversation stream.
- Low-signal one-line answers do not benefit from explicit view switching.
- The user asked for a subtle affordance near the timestamp, so the control must stay sparse.

Alternatives considered:
- Always show the toggle for all assistant plain-text messages: rejected because it would over-instrument the chat surface.
- Hide the toggle and rely only on auto mode: rejected because heuristic misclassification still needs a local escape hatch.

## Risks / Trade-offs

- [Risk] Conservative heuristics may leave some readable long-form replies in the normal bubble presentation. → Mitigation: keep the manual switch available for eligible structured replies and refine thresholds through tests after real usage.
- [Risk] Some short structured prompts such as follow-up questions with numbered bullets may still be classified as reading-mode eligible. → Mitigation: require stronger structure or minimum content density before defaulting into reading mode.
- [Risk] Reusing the existing markdown subset means some markdown constructs will still render as raw text. → Mitigation: keep the first release scoped to the supported subset and avoid implying full markdown compatibility.
- [Risk] Adding even a subtle toggle can clutter dense message metadata. → Mitigation: place it near the timestamp, use text-only styling, and only show it for meaningfully switchable messages.
- [Risk] Finalized messages may still change layout once when the stream completes and the heuristic runs. → Mitigation: explicitly defer classification until the message reaches the completed state so that only one post-stream presentation convergence occurs.

## Migration Plan

1. Add a frontend-only reading-mode eligibility helper for completed assistant plain-text messages.
2. Add transient per-message override state in the workbench store for `assistant text` message presentation.
3. Render eligible assistant plain-text messages through a conversation-scoped markdown-reading surface while preserving the existing raw-text bubble path.
4. Add the low-profile `阅读 / 原文` control near the timestamp for eligible completed messages only.
5. Cover the heuristic and manual-toggle paths with conversation rendering tests.

Rollback strategy:

- Remove the reading-mode eligibility helper, per-message override state, and toggle control.
- Return assistant plain-text messages to the existing raw bubble-only rendering path.
- No backend rollback or data migration is required because the change does not persist new message state.

## Open Questions

None currently. The current scope is intentionally narrow enough to proceed without further protocol or persistence decisions.
