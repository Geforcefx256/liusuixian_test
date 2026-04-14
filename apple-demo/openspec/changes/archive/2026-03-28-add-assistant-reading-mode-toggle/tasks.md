## 1. Message presentation state and eligibility

- [x] 1.1 Add a frontend helper that classifies completed `assistant` plain-text messages into reading-mode eligible or normal bubble mode using conservative structured-text heuristics.
- [x] 1.2 Add transient per-message view override state in the workbench store for eligible assistant plain-text messages without persisting that override through backend session history.
- [x] 1.3 Ensure streaming assistant text messages and non-text assistant message kinds bypass the reading-mode eligibility and override path.

## 2. Conversation rendering and manual toggle

- [x] 2.1 Add a conversation-scoped reading-mode renderer for eligible assistant plain-text messages by reusing the existing controlled markdown rendering pipeline with conversation-appropriate typography and spacing.
- [x] 2.2 Keep non-eligible assistant plain-text messages on the current raw bubble path and preserve the existing dedicated renderers for protocol, result, and error messages.
- [x] 2.3 Add a low-profile per-message `阅读 / 原文` toggle near the timestamp for eligible completed assistant plain-text messages only, and make sure the toggle affects only the owning message.

## 3. Verification

- [x] 3.1 Add frontend tests that cover default reading-mode classification for structured completed assistant plain-text messages and default raw-bubble behavior for short conversational replies.
- [x] 3.2 Add frontend tests that cover manual per-message toggle behavior, including switching between rendered and raw views without affecting neighboring messages.
- [x] 3.3 Add frontend tests that verify streaming assistant text does not reflow mid-generation and that manual view overrides are recomputed rather than restored after session reload.
