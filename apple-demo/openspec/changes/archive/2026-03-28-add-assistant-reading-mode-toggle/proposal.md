## Why

The workbench currently renders normal assistant text messages as plain `<p>` content with preserved newlines, so longer structured replies often appear like raw markdown documents instead of readable conversation content. This needs to change now because the product already supports richer assistant surfaces for protocol and result messages, but plain assistant text still degrades the perceived quality of the main conversation experience.

## What Changes

- Add a lightweight reading-mode presentation for completed assistant plain-text messages that contain strong structured-text signals such as headings, lists, code fences, or longer multi-paragraph content.
- Keep short conversational assistant replies in the existing bubble-style presentation instead of forcing every plain-text message into a document-like surface.
- Add a low-profile per-message manual toggle near the timestamp so the user can switch between rendered reading mode and raw text for eligible assistant plain-text messages.
- Limit the first version to frontend presentation only: no backend message schema changes, no new persisted message kind, and no saved per-message preference across refreshes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: change conversation rendering requirements so completed assistant plain-text messages can auto-switch into a readable markdown-like presentation and expose a manual per-message view toggle without affecting structured protocol, result, or error surfaces.

## Impact

- Affected frontend code in the workbench conversation rendering path, especially assistant text-message presentation and message-local UI state.
- Likely affected files include `apps/web/src/components/workbench/ConversationPane.vue`, `apps/web/src/stores/workbenchStore.ts`, and the existing controlled markdown rendering utilities.
- Affected tests include conversation rendering coverage for assistant plain-text messages and any new toggle or heuristic behavior.
