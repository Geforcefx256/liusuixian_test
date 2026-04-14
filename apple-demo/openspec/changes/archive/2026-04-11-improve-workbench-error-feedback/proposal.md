## Why

The current workbench forwards some model transport failures and timeout details too directly into the conversation surface, which exposes raw backend error text that is not suitable as end-user guidance. At the same time, tool execution failures are not surfaced as a visible recovery or terminal status in the workbench flow, so users cannot tell whether the agent is retrying, recovering, or has stopped.

## What Changes

- Refine runtime error presentation so model/network failures expose concise user-facing summaries, recovery guidance, and internal details separately instead of showing raw backend failure text by default in the conversation surface.
- Extend the runtime-to-workbench error contract with structured tool failure metadata and intermediate tool failure lifecycle events so the frontend can distinguish retrying, recovering, denied, and terminal tool outcomes.
- Update the workbench conversation experience to render layered failure feedback: status header, user-facing summary, recovery guidance, and opt-in technical details for terminal failures.
- Make tool failure progress visible in the active conversation flow so users can see when a tool is being retried or when a tool failure has stopped the run.
- Preserve the existing conversation-first shell and current service split; this change does not introduce new top-level directories or third-party dependencies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: Change the workbench conversation contract so runtime failures are rendered as layered, user-facing feedback and tool failure progress becomes visible during active runs.
- `agent-backend-runtime`: Change the runtime streaming and terminal error contract so model failures, tool failures, and tool recovery states expose structured metadata suitable for user-safe workbench rendering.

## Impact

- Runtime error shaping, stream event types, and tool failure metadata in `apps/agent-backend`.
- Agent API types, run-stream event handling, and conversation state updates in `apps/web`.
- Workbench conversation rendering for terminal error cards, status headers, and optional technical details in `apps/web`.
- Frontend and backend tests that cover model timeout feedback, tool retry visibility, and terminal tool failure messaging.
