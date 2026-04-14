## Context

Question Tool currently pauses a run by emitting a fixed awaiting-interaction sentence while the real question content only exists inside the structured pending-question payload. The workbench therefore shows a generic assistant bubble plus a separate question card, which weakens conversation continuity in both the live turn and persisted history.

The current runtime also filters awaiting-question replay artifacts partly by matching one fixed assistant text literal. That coupling is fragile once the assistant bubble becomes dynamic. The change needs to improve the user-visible bubble without turning the bubble text into a new source of truth for continuation, replay, or validation.

## Goals / Non-Goals

**Goals:**
- Generate a deterministic chat-style assistant summary for pending question interactions from trusted structured payload data.
- Keep the pending-question card as the authoritative structured interaction UI and continuation contract.
- Preserve stable replay behavior by identifying awaiting-interaction artifacts through structured markers instead of exact placeholder text.
- Keep the implementation dependency-free and conservative, with explicit fallbacks rather than inference-heavy rewriting.

**Non-Goals:**
- Changing the Question Tool request/response contract, reply flow, or pending-question card mechanics.
- Expanding select options, degraded reference options, or technical failure reasons into the assistant bubble.
- Using model inference, NLP, or heuristic-rich semantic rewriting to paraphrase prompts.
- Rewriting legacy persisted history entries that already store the old placeholder sentence.

## Decisions

### 1. Backend owns summary generation

The runtime will generate the awaiting-question assistant summary from the pending interaction payload and persist that same text as the canonical assistant message text for the turn.

Rationale:
- The summary then has one source of truth for live runs, persisted session history, and any future API consumers.
- The frontend can render the summary directly instead of duplicating business rules in multiple mapping paths.

Alternatives considered:
- Generate the summary in the frontend from `interaction.payload`.
  Rejected because it duplicates formatting logic, risks divergence between live and reloaded sessions, and makes backend tests blind to the displayed summary contract.

### 2. Summary generation uses deterministic formatting rules with conservative fallbacks

The summary builder will only read trusted fields already present in the interaction payload:
- `prompt`
- primary field labels in declared order
- field types
- degraded flag

The formatter will stay conservative:
- Single-field `text`: prefer the existing prompt; if the prompt is missing or matches a small generic-placeholder rule set, fall back to the field label; end with a fill-and-continue cue.
- Single-field `select`: prefer the existing prompt; if the prompt is missing or generic, fall back to the field label; end with a choose-and-continue cue.
- Multi-field: keep the prompt when available and append all primary field labels in order; do not collapse high field counts in this change.
- Supplementary `notes` fields are excluded from the summary field list unless they are the only available field.
- Degraded questions still produce a concise question summary, but the bubble does not repeat degraded failure reasons or reference option lists.
- If trusted prompt and field-label data are both unusable, fall back to the current generic waiting sentence.

Rationale:
- This satisfies the request for a stable implementation that cannot fail because a free-form bubble had to be reparsed later.
- It keeps the summary readable without guessing hidden semantics or restating UI-only details.

Alternatives considered:
- Free-form rewriting with model assistance.
  Rejected because it adds non-determinism and debugging cost.
- Expanding all select options into the bubble.
  Rejected because it duplicates the card and increases noise.

### 3. Replay filtering will key off structured awaiting-interaction markers, not bubble text

The runtime currently treats awaiting-question content as a technical waiting artifact for future replay. That behavior remains, but the replay filter will no longer depend on a single literal assistant sentence.

Instead, canonical awaiting-interaction assistant messages will be recognized through the structured awaiting-interaction tool snapshot already carried on the same assistant message. Replay filtering can then drop the waiting artifact message parts as a unit based on that structured marker.

Rationale:
- Dynamic summaries become safe because replay logic no longer depends on one exact string value.
- No new persisted data model is required for this change.

Alternatives considered:
- Keep exact-string filtering and update the string list as templates evolve.
  Rejected because it reintroduces fragile coupling.
- Introduce a new persisted message kind just for awaiting-question bubbles.
  Rejected because the existing structured marker is sufficient and lower risk.

### 4. The workbench will render the backend-provided summary as-is

The workbench will continue to use the pending-question card for structured input, while the assistant bubble body for an awaiting-question turn will display the backend-provided summary text. The frontend will not recompute or reinterpret the summary from field data.

Rationale:
- Backend and frontend stay aligned on exactly what the user saw in that turn.
- Reloaded sessions preserve the same readable summary without client-only caching.

Alternatives considered:
- Have the frontend re-summarize the payload so UI copy can evolve independently.
  Rejected because it splits one contract into two implementations and makes regression testing harder.

## Risks / Trade-offs

- [Risk] Multi-field summaries can become longer because this change lists all primary fields. -> Mitigation: keep a single-sentence template and exclude supplementary `notes` fields.
- [Risk] Generic-prompt detection may classify some borderline prompts as generic. -> Mitigation: restrict the generic check to a small explicit rule set used only in the single-field path.
- [Risk] Existing persisted sessions will keep the old placeholder text. -> Mitigation: accept legacy history as-is and apply the new summary contract only to newly produced awaiting-question turns.
- [Risk] Backend/frontend rollout mismatch could briefly show mixed old/new bubbles across running instances. -> Mitigation: keep the frontend rendering contract backward-compatible by treating `result.text` as opaque summary text.

## Migration Plan

No data migration is required. New awaiting-question turns will persist the new summary text, while historical sessions keep their stored assistant text unchanged.

Deployment can ship as a normal backend + frontend update. Rollback is a code rollback that restores the fixed waiting sentence and the previous replay-artifact detection behavior.

## Open Questions

- None.
