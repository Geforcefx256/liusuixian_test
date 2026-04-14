## Why

The current workbench conversation UI renders assistant messages as a single plain bubble, which makes in-flight runs feel opaque compared with modern chat products that provide a lightweight "thinking" or progress cue. Users can see text streaming and final results, but they cannot tell at a glance whether the assistant is still working, has switched into an interactive step, or completed the turn through direct response versus tool-assisted execution.

This change is needed now because the conversation surface is already carrying more structured runtime signals than the UI exposes, and the missing lightweight status cue makes the assistant feel flatter and less trustworthy than the underlying runtime actually is. The user has also clarified that the desired experience is intentionally minimal: one assistant-only header bubble, simple summaries, and no persisted intermediate timeline.

## What Changes

- Add a lightweight assistant-only status header above the assistant message body in the workbench conversation stream.
- Show a single in-flight status during the current run, such as queued, thinking, generating, waiting for confirmation, or failed, rather than a fine-grained tool timeline.
- Converge that in-flight header into a short final summary for the current turn, such as direct response, generated interactive step, generated result, or tool-assisted response with a compact tool list.
- Keep the status header transient in frontend conversation state only; do not persist intermediate header state into session history and do not require session reload or session switching to recover it.
- Use real runtime signals already available to the workbench where possible, while treating optional execution details such as skill identity as non-blocking for the first version.
- Preserve the current conversation-first shell and structured message rendering model rather than introducing a separate assistant cockpit, execution timeline panel, or debug trace surface.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: extend assistant message presentation so the conversation stream shows a transient assistant status header during the active turn and a lightweight final execution summary after completion, without persisting intermediate header state across session reloads.

## Impact

- Frontend conversation rendering in `apps/web`, especially assistant message components and the workbench conversation store.
- Stream-event handling and in-memory run-state convergence for the active assistant placeholder message.
- Workbench message presentation tests covering assistant streaming, protocol convergence, result convergence, and runtime failure feedback.
- No intended change to persisted session-message contracts, protocol-state persistence, backend file APIs, or cross-session history recovery behavior for this change.
