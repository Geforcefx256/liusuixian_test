## 1. Session History And Summary Data

- [x] 1.1 Update `workbenchStore` session load/reload flows to request `pending`, `answered`, and `rejected` interactions together and retain both the active pending interaction and resolved interaction lookup data.
- [x] 1.2 Extend the persisted user-message rewrite path to parse resolved Question Tool continuation text and build readable answer or rejection summaries from interaction metadata.

## 2. Conversation Presentation

- [x] 2.1 Add a display-layer grouping model for contiguous completed assistant plain-text messages that produces one main bubble plus collapsed process steps without mutating the underlying raw `UiMessage[]`.
- [x] 2.2 Update the conversation rendering components to show the grouped assistant presentation with a collapsed-by-default process section while keeping streaming and structured assistant messages on their existing render paths.

## 3. Verification

- [x] 3.1 Add store/protocol-runtime tests covering resolved question summary rewriting, select-label rendering, notes rendering, rejection rendering, and reload recovery.
- [x] 3.2 Add conversation rendering tests covering single-message passthrough, multi-step assistant collapse, and the rule that streaming or structured assistant messages do not collapse into the folded history view.
