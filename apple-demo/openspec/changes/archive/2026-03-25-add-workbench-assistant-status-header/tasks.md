## 1. Assistant Header State Model

- [x] 1.1 Extend the workbench frontend message presentation model so assistant messages can carry a transient header state and the active session can keep an ephemeral finalized-header overlay keyed by assistant message identity.
- [x] 1.2 Update workbench stream-event handling to map existing lifecycle and text-stream events into coarse in-flight assistant header states without introducing a detailed execution timeline.
- [x] 1.3 Update terminal run convergence so the frontend computes the final assistant header summary from terminal output kind, runtime failure state, and tool metrics, then preserves that summary across the immediate same-session reload without persisting it to backend history.
- [x] 1.4 Clear transient assistant-header overlays when the active agent, active session, or blank-draft context changes so stale headers do not leak into unrelated conversations.

## 2. Conversation Rendering

- [x] 2.1 Update the conversation message rendering path so assistant bubbles can show a compact single-line header above plain-text, protocol, rich-result, and error message bodies.
- [x] 2.2 Keep the header assistant-only, visually subdued, and attached to the owning message bubble rather than introducing a global status banner, side panel, or expanded trace surface.
- [x] 2.3 Ensure protocol cards, result cards, and failure cards continue to render through their existing message-body components while the new header only adds coarse execution context.

## 3. Verification

- [x] 3.1 Add frontend store tests for coarse in-flight assistant header states during queued, thinking, generating, and failed runs.
- [x] 3.2 Add frontend tests for final header-summary convergence across tool-assisted runs, protocol results, structured results, and runtime failures.
- [x] 3.3 Add coverage for the same-session reload path so the current-turn assistant header remains visible without requiring backend persistence.
- [x] 3.4 Verify that switching sessions, creating a new blank draft, or changing agents clears the transient assistant-header overlays as intended.
