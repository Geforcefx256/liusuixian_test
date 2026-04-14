## Why

The workbench currently preserves line breaks for raw assistant text bubbles, but eligible assistant messages switch into reading mode where paragraph rendering collapses source newlines into a single visual line. This matters now because longer planning replies, tabular-looking text, and question-related summaries become harder to read even though the original text already contains the intended line structure.

## What Changes

- Change workbench assistant reading-mode rendering so source line breaks inside normal text paragraphs remain visually visible in the conversation bubble.
- Keep the scope limited to visual line-break preservation for existing text content instead of introducing full GFM table support or backend message-shape changes.
- Ensure the same visual line-break expectation holds across conversation text surfaces that already treat text as plain content rather than structured rich-result payloads.
- Add focused tests for multiline assistant text and other affected workbench text surfaces so newline-preservation regressions are caught automatically.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: change conversation text rendering requirements so multiline assistant text that enters reading mode still preserves visible line breaks from the original message content.

## Impact

- Affected frontend code in the workbench conversation rendering path, especially assistant text reading-mode rendering and any shared text-surface helpers used by protocol-style question content.
- Likely affected files include `apps/web/src/components/workbench/AssistantTextMessage.vue`, `apps/web/src/components/workbench/markdownPreview.ts`, and related workbench rendering tests.
- No top-level directory changes, backend API changes, or third-party dependency changes are expected for this change.
