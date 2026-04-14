## Context

The runtime already has run-level cancellation primitives:

- `/agent/api/agent/runs/:runId/cancel` aborts an active run by `runId`
- disconnecting the `/agent/run` stream also triggers run cancellation
- terminal stream events already distinguish `cancelled` from `error`, `success`, and `awaiting-interaction`

What the product does not have is a coherent stop contract across frontend and backend:

- the workbench does not keep track of the active `runId`
- the conversation UI has no explicit stop affordance
- cancelled runs currently converge through the generic error branch instead of a user-intent-specific presentation
- durable side effects such as pending question interactions or saved plan state are not rolled back, so a naive “everything becomes stopped” rule would lie to the user

There is also an important implementation constraint: tool invocation does not yet propagate a shared cancellation signal through the full provider stack. Some surfaces, such as governed script execution, can already kill child processes once they receive a signal, but the common invoke request contract does not currently carry that signal end-to-end. The first version therefore has to treat stop as a best-effort run cancellation request, not as a universal rollback primitive.

## Goals / Non-Goals

**Goals:**

- Let the user stop only the current active run in the selected session.
- Keep stop semantics run-scoped rather than session-scoped.
- Distinguish user-requested cancellation from generic execution failure in the current-turn UI.
- Converge to transient `已停止` only when cancellation wins before any authoritative session state from that run needs to remain visible.
- Preserve authoritative session state when cancellation races with persisted question/plan outcomes.
- Expose explicit behavior for stop-in-progress, cancel transport failure, and cancel no-op responses.

**Non-Goals:**

- Stopping every queued run in the same session.
- Rolling back workspace files, output artifacts, or external side effects produced before cancellation was observed.
- Introducing a new backend-persisted “stopped assistant message” record.
- Redesigning tool execution around full transactional rollback semantics.
- Guaranteeing immediate interruption for every tool provider in the first release.

## Decisions

### Decision: Model stop as a run-scoped cancel request, not a session reset

The product SHALL treat stop as “cancel the current active run” and nothing more. The target identity is the active `runId` for the selected session, not the `sessionId` itself.

The frontend will store transient current-run state including:

- active `runId`
- owning `sessionId`
- whether a stop request is in flight

Rationale:

- The user explicitly scoped stop to the current run rather than the entire session.
- The backend already exposes a run-level cancel primitive; reusing it keeps the change small and consistent.
- A session-level stop would require queue semantics, history semantics, and broader rollback decisions the user did not ask for.

Alternatives considered:

- Stop the entire session queue: rejected because it exceeds the requested scope and changes coordinator semantics.
- Add a dedicated session-stop endpoint first: rejected because the existing run-level endpoint is sufficient for the first product version.

### Decision: Enable stop only once the active run identity is known

The frontend SHALL enable the stop action only after the stream reports the active `runId` through `lifecycle.start`. Before that point, the run is considered starting but not yet cancellable from the UI.

Rationale:

- The current browser request does not send a client-generated `runId`; the authoritative `runId` is created server-side.
- Avoiding “stop before runId exists” removes one avoidable request-failure path.

Alternatives considered:

- Extend the client request to pre-generate `runId`: rejected for the first version because it expands the request contract when the current stream already supplies the identifier.
- Optimistically expose stop immediately and fail if `runId` is missing: rejected because it creates a self-inflicted UX error path.

### Decision: Converge cancellation through authoritative terminal outcome plus session reload

The frontend SHALL treat the cancel API response as an acknowledgement channel, not as the final truth. The authoritative outcome remains the terminal stream event plus refreshed session state.

Recommended frontend flow:

1. user clicks `停止`
2. UI enters `停止中...`
3. current partial assistant text remains visible while the request is in flight
4. frontend posts `/runs/:runId/cancel`
5. frontend waits for the run’s terminal stream outcome
6. when the terminal outcome is `cancelled`, the frontend reloads the active session before deciding whether to keep a transient stopped placeholder or replace it with authoritative session state

Rationale:

- The cancel route answers only whether an active in-memory run was aborted at that instant.
- Session reload is needed to distinguish a pure cancelled run from a race where the run already persisted authoritative state such as a pending interaction or saved plan.

Alternatives considered:

- Treat cancel-route success as immediate final success: rejected because it ignores terminal stream ordering and persistence races.
- Immediately clear the assistant bubble on click: rejected because it hides useful context and can briefly erase state that later turns out to be authoritative.

### Decision: Use session-authoritative persistence as the boundary for “已停止”

The frontend SHALL show transient `已停止` only when cancellation wins before the run produces authoritative persisted session state that must remain visible in the conversation view.

For the first version, the explicit authoritative cases are:

- pending question interaction / awaiting-interaction state
- saved plan state and the corresponding plan decision surface
- any persisted assistant artifact that becomes the latest authoritative turn for the active session

If session reload reveals one of those states, the frontend SHALL render that real state instead of forcing the turn to appear as stopped.

Rationale:

- Users care about whether the system truly paused without producing a durable next step.
- A generic stopped result is only honest when nothing authoritative from that run survived.
- This matches the existing architecture, where interactions and plans already outlive a single streaming request.

Alternatives considered:

- Force every user stop into `已停止`: rejected because it would lie whenever question/plan state had already been committed.
- Roll back all committed state to preserve a universal stopped terminal: rejected because the current architecture does not support reliable rollback for those paths.

### Decision: Treat cancel route outcomes as three separate UX cases

The frontend SHALL distinguish:

1. cancel transport/HTTP failure
2. cancel acknowledged but `cancelled: false`
3. terminal run outcome `cancelled`

Recommended behavior:

- transport/HTTP failure: leave the run alive, exit `停止中...`, and surface `停止失败`
- `cancelled: false`: treat as an acknowledged no-op, not as an error; keep waiting for the authoritative terminal state that is already in progress or already completed
- terminal `cancelled`: converge via the authoritative reload rules above

Rationale:

- `cancelled: false` usually means the run already ended or was already cancelled; it is semantically different from a failed request.
- Blending these cases would make the UI either too noisy or too optimistic.

Alternatives considered:

- Treat `cancelled: false` as an error: rejected because it is usually a benign race.
- Hide request failures and silently keep waiting: rejected because the user explicitly asked for visible stop failure.

### Decision: Keep stop available across running phases instead of special-casing tool types

The product SHALL allow stop whenever a run is active, regardless of whether the runtime is currently waiting on model generation, local tools, governed scripts, or MCP tools.

The first version will document one limitation explicitly: stop is best-effort during tool execution because tool invocation does not yet propagate a uniform cancellation signal through every provider.

Rationale:

- Users think in terms of “stop this run,” not “stop only when the model is generating text.”
- The runtime already models cancellation at the run level.
- Special-casing tool names would produce arbitrary holes in the control surface.

Alternatives considered:

- Disable stop for all tool phases: rejected because long or runaway tools are one of the reasons users want stop.
- Disable stop only for `question`: rejected because the real boundary is durable state, not the tool name itself.

## Risks / Trade-offs

- [Race between cancellation and persistence] → Mitigation: reload authoritative session state after terminal cancellation and let persisted interaction/plan state win over a synthetic stopped view.
- [Users may read `已停止` as “everything rolled back”] → Mitigation: keep the design explicit that stop only cancels the active run and does not revert prior tool side effects.
- [Tool execution may continue briefly after stop is requested] → Mitigation: document best-effort semantics for the first version and keep failures visible rather than pretending strong interruption.
- [Current-turn convergence may need extra local bookkeeping to decide whether a stopped placeholder should survive a reload] → Mitigation: keep this bookkeeping frontend-only and scoped to the active run/session pair.
- [A cancel no-op response may feel confusing if the run completes at nearly the same time] → Mitigation: treat `cancelled: false` as benign and continue waiting for the already-authoritative terminal event.

## Migration Plan

1. Add frontend active-run tracking from `lifecycle.start`, plus stop-in-progress state and a cancel API wrapper.
2. Update the conversation surface to render a stop control only for the current active run in the selected session.
3. Update frontend run convergence so cancelled runs reload session state and only show transient `已停止` when no authoritative persisted state from that run supersedes it.
4. Reuse the existing backend cancel endpoint, but formalize its browser-facing semantics for active-run cancel, no-op cancel, and non-rollback of prior side effects.
5. Add tests covering happy-path stop, cancel transport failure, cancel no-op, and races with pending interaction / saved plan state.

Rollback strategy:

- Remove the frontend stop control and transient stop state handling, returning the workbench to passive wait-for-completion behavior.
- No data migration rollback is required because the first version does not introduce a persisted stopped message or new database tables.

## Open Questions

- None for the first proposal. The remaining known limitation is tool-phase best-effort cancellation, which is an accepted implementation constraint rather than an unresolved product decision.
