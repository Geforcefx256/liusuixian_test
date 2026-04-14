## Why

The current conversation composer makes run-in-progress feedback feel heavier than necessary. A prominent `处理中...` send-button state competes with the actual stop affordance, while stop-pending feedback should read as a local action state rather than a new page-level status.

## What Changes

- Remove the send button's running-state `处理中...` label and keep the send action visually quiet while a run is active.
- Refine the stop control into a danger-tinted secondary action that stays lower priority than the primary send CTA while still reading as an interruption action.
- Show stop-pending feedback inside the stop button itself with a compact spinner and width-stable label treatment instead of introducing an extra status bar or stronger global emphasis.
- Preserve the existing cancelled terminal presentation and stop semantics; this change only adjusts frontend interaction design and visual hierarchy.

## Capabilities

### New Capabilities

### Modified Capabilities
- `agent-web-workbench`: refine conversation-composer running and stop-pending feedback so stop remains a local inline action and generic run-in-progress feedback no longer appears as a prominent send-button processing state

## Impact

- Frontend conversation composer UI in `app/web/src/components/workbench/ConversationPane.vue`
- Shared button styling in `app/web/src/styles.css`
- Workbench component tests covering running and stop-pending button states
