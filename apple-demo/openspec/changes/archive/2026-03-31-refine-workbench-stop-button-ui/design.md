## Context

The workbench already supports run-scoped stop semantics and converges terminal cancellation to `已停止`. The remaining issue is interaction hierarchy inside the conversation composer: the send button currently advertises a prominent `处理中...` running state while the stop control is visually styled like any other neutral secondary action. That makes the interrupt path feel less intentional than the generic running state and creates avoidable visual noise during normal streaming.

This refinement is frontend-only and stays within the existing workbench contract. It does not change cancel timing, terminal convergence, backend APIs, or persisted session state. The change is limited to conversation-composer affordances, shared button styling, and tests that assert the new visual-state contract.

## Goals / Non-Goals

**Goals:**
- Keep run-in-progress feedback visible without promoting it to a stronger primary CTA state.
- Make stop-pending feedback local to the stop control with a compact spinner and stable layout.
- Give the stop control an interruption-specific visual treatment that reads as more cautionary than neutral but less severe than a destructive delete action.
- Preserve existing `已停止` terminal convergence and stop semantics.

**Non-Goals:**
- Changing backend cancellation behavior or run lifecycle state handling.
- Introducing a new composer-level banner, toast, or global progress bar for stop-pending.
- Changing the meaning of `已停止` or removing the existing stop side-effect disclaimer.
- Redesigning the broader workbench button system beyond the stop control and send-button running label.

## Decisions

### Decision: Keep stop-pending feedback inside the stop button

When a stop request is in flight, the stop control will remain in place and switch to a compact `spinner + 停止中` presentation. The button will stay disabled while pending, and its inline size will remain stable across `停止` and `停止中`.

Rationale:
- Stop is a local action on the current run, so its pending state should stay attached to that action.
- Inline feedback avoids introducing a competing page-level status surface.
- Width stability prevents the composer action row from shifting during a frequent interaction.

Alternatives considered:
- Add a separate status strip below the composer: rejected because it over-amplifies a local action and duplicates the button state.
- Show text-only `停止中...` without a spinner: rejected because the user loses immediate visual confirmation that the request is actively pending.

### Decision: Remove the send button's `处理中...` running label

While a run is active, the send button will remain disabled but keep its resting `发送` label instead of switching into a prominent processing label.

Rationale:
- The conversation stream itself already exposes that work is in progress through the assistant placeholder and partial output.
- A prominent processing label on the primary CTA draws attention away from the actual interrupt affordance.
- Keeping the label stable reduces visual churn in the composer during every run.

Alternatives considered:
- Keep `处理中...` on the send button: rejected because it overstates a generic state the rest of the conversation already communicates.
- Hide the send button entirely while running: rejected because it causes layout movement and weakens action predictability.

### Decision: Style stop as a danger-tinted secondary action

The stop control will use a danger-tinted secondary treatment distinct from both the neutral secondary button and the primary send button. The style should signal interruption intent without escalating to the fully destructive tone used for irreversible deletion.

Rationale:
- Users need to distinguish `停止` from benign secondary actions at a glance.
- A softer danger treatment matches the semantics of canceling an active run without implying data deletion or rollback.
- Reusing the existing primary CTA color for stop would collapse action hierarchy and create avoidable confusion.

Alternatives considered:
- Keep the current neutral secondary style: rejected because stop lacks enough visual distinction from low-risk actions such as upload.
- Use a solid destructive red button: rejected because stop is reversible at the task-flow level and does not delete persisted artifacts.

## Risks / Trade-offs

- [Stop styling becomes too subtle] → Mitigation: use a dedicated danger tint with stronger hover/focus states than neutral secondary buttons.
- [Removing `处理中...` makes running state feel under-signaled] → Mitigation: preserve disabled send state, streamed assistant placeholder, and inline stop-pending feedback.
- [Inline spinner causes button jitter] → Mitigation: keep fixed minimum width and align spinner/text in a stable inline layout.

## Migration Plan

1. Update the conversation composer button rendering so the send button keeps its static label during active runs.
2. Add a stop-button pending indicator with compact inline spinner markup and stable sizing.
3. Add a danger-tinted stop-button variant in shared/frontend-local styles.
4. Update component tests for running and stop-pending behavior.

Rollback strategy:

- Remove the spinner markup and danger-tinted variant, then restore the send-button `处理中...` label.
- No backend or persisted data rollback is required because the change is presentation-only.

## Open Questions

- None. The product-level behavior and styling direction have been aligned.
