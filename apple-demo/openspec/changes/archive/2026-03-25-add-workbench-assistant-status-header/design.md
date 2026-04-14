## Context

The workbench conversation surface already receives enough runtime information to present a lightweight assistant progress cue:

- the stream emits coarse lifecycle events such as queued, text streaming, and terminal completion
- terminal run results already distinguish protocol output, structured results, plain text, and runtime failures
- run metrics already expose whether tools were used during the turn

What the UI lacks is not raw data volume, but a small presentation layer that turns those signals into a simple assistant-facing status line. The user has explicitly scoped this change to a minimal experience:

- assistant messages only
- one single-line header above the assistant bubble
- coarse progress cues such as "thinking" rather than a full execution timeline
- no requirement to preserve intermediate header state in persisted session history or across session switching

There is one important implementation constraint in the current frontend flow: after a successful run, the workbench reloads the active session history from the backend. A header that exists only on the local in-flight placeholder message would therefore disappear immediately unless the frontend keeps a session-scoped transient overlay for the current view.

## Goals / Non-Goals

**Goals:**
- Add a lightweight assistant-only status header above assistant message bodies in the conversation stream.
- Show a single coarse in-flight state during the active turn.
- Converge that header into a short final summary after the turn completes.
- Use existing frontend runtime signals without requiring a new backend persistence contract.
- Preserve the current-turn header through the immediate same-session refresh that happens after successful completion.

**Non-Goals:**
- Building a detailed execution timeline with tool start/end rows or expandable trace views.
- Persisting intermediate header state in session history.
- Recovering transient header state after switching away from the session or reopening it later.
- Adding a new assistant sidebar, observability panel, or debug console for this change.
- Making skill identity a blocking requirement for the first release when that metadata is not consistently populated in terminal results.

## Decisions

### Decision: Model the assistant header as frontend-owned transient presentation state

The workbench SHALL represent the assistant header as frontend-owned transient presentation state rather than as a persisted session-message field.

That state should have two scopes:

- an in-flight header attached to the local assistant placeholder while the run is active
- a session-scoped ephemeral overlay keyed by assistant message identity so the final summary can survive the immediate same-session reload that follows a successful run

Rationale:
- The user does not want history persistence for intermediate state.
- Persisting this state would expand the backend message contract for a purely presentational concern.
- A small frontend overlay is enough to keep the current view stable without changing backend storage.

Alternatives considered:
- Persist the header in session history: rejected because it would add backend contract surface for a transient UI concern the user explicitly does not want to archive.
- Keep the header only on the local placeholder message: rejected because the current post-run session reload would erase it immediately.

### Decision: Drive in-flight states from existing stream events only

The first version SHALL derive coarse in-flight header states from existing stream events rather than adding new backend events.

Recommended mapping:
- before meaningful stream activity: `思考中`
- `lifecycle.queued`: `排队中`
- `assistant.delta`: `正在生成回复`
- terminal runtime failure: `执行失败`

Rationale:
- The user wants a simple OpenAI-like cue, not a detailed execution trace.
- Existing events already provide enough signal for a credible coarse status.
- Avoiding new backend events keeps the change scoped to the frontend message layer.

Alternatives considered:
- Add explicit tool-start, tool-end, and skill-selected events: rejected because the user explicitly does not need that level of detail.
- Infer state from message text only: rejected because event-driven mapping is more stable than content heuristics.

### Decision: Derive the final summary from terminal output kind and run metrics

The final assistant header summary SHALL be derived from terminal structured result metadata and run metrics, not from raw assistant text.

Recommended summary rules:
- `metrics.tools.length > 0`: show a compact tool-assisted summary such as `使用 Tools: readFile, searchInFiles`
- `output.kind === "protocol"`: show an interactive-step summary such as `等待你确认`
- `output.kind === "domain-result"`: show a result-oriented summary such as `生成结果`
- plain successful text response without tools: show `直接回答`
- failed run: show `执行失败`

Skill identity is optional for this change. If a trustworthy skill identifier becomes available in terminal results, the summary MAY include it, but the first release MUST NOT depend on that metadata.

Rationale:
- Terminal output kind and tool metrics are the most trustworthy coarse execution signals already exposed to the frontend.
- Final summary should describe execution mode, not rephrase the assistant body.
- Making skill identity optional avoids blocking the change on runtime metadata that is not yet consistently populated.

Alternatives considered:
- Generate the summary by re-parsing assistant text: rejected because that would be brittle and less trustworthy than the structured terminal result.
- Require both tool and skill details in every summary: rejected because the runtime currently does not guarantee both.

### Decision: Render the header inline inside assistant bubbles only

The header SHALL render inline at the top of assistant message bubbles and SHALL NOT appear for user messages.

Rationale:
- The feature is meant to clarify the meaning of a specific assistant turn.
- Inline placement keeps the cue attached to the message it explains.
- A global banner or side panel would weaken local message context and add more layout complexity than the user asked for.

Alternatives considered:
- Use a global top status bar for the whole conversation: rejected because it would detach the cue from the owning assistant message.
- Add a separate assistant execution panel: rejected because it would introduce a heavier product surface than needed.

### Decision: Clear transient header overlays when conversation context changes

The frontend SHALL treat header overlays as current-view state and clear them when the conversation context changes materially, such as switching sessions, starting a blank draft, or changing the active agent.

Rationale:
- The user does not require cross-session or reopen recovery for these headers.
- Context-scoped cleanup avoids accidental leakage of stale summaries into unrelated conversations.

Alternatives considered:
- Preserve overlays indefinitely in memory: rejected because stale headers would become increasingly likely as the user navigates between sessions.

## Risks / Trade-offs

- [Risk] Coarse in-flight states may feel less informative than a full execution trace. → Mitigation: keep the product copy explicit that the header is a lightweight progress cue, not a debugging timeline.
- [Risk] The same-session refresh path can still drop the final header if overlay keys do not line up with the persisted `assistantMessageId`. → Mitigation: bind the final header to the terminal `assistantMessageId` before reloading and cover that path with tests.
- [Risk] Some successful turns may only be able to show a generic summary because skill identity is not yet reliable. → Mitigation: make tool-based and output-kind-based summaries the required baseline, and treat skill labeling as optional enrichment.
- [Risk] Inline header styling could make assistant bubbles feel busier if overdesigned. → Mitigation: keep the header to a single compact line with subdued visual treatment and no nested trace UI.

## Migration Plan

1. Extend the frontend workbench message presentation model with transient assistant-header metadata and a session-scoped ephemeral overlay for finalized headers.
2. Update stream-event handling so the active assistant placeholder receives coarse in-flight states from existing lifecycle and text-stream events.
3. Update terminal run convergence so the final header summary is computed from `AgentRunResult.output`, `runtimeError`, and `metrics.tools`, then rebound to the persisted assistant message identity before the same-session reload.
4. Update conversation rendering so assistant bubbles can display the header above plain-text, protocol, result, and error message bodies.
5. Clear transient overlays when the active session, draft state, or active agent changes.
6. Add frontend tests for in-flight header rendering, tool-assisted final summary, protocol/result summary convergence, failure status, and same-session reload retention without backend persistence.

Rollback strategy:

- Remove the transient overlay state and inline header rendering, returning to the current plain assistant bubble presentation.
- No backend migration or data cleanup is required because this change does not persist new header state.

## Open Questions

None currently. The change is scoped narrowly enough to proceed to implementation.
