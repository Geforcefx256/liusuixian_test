## 1. Confirmation State Refactor

- [x] 1.1 Replace the `window.confirm` paths in `SessionRail` with component-local destructive action state while keeping the existing delete-session and clear-history emits unchanged
- [x] 1.2 Make the history menu, single-session delete confirmation, and bulk-clear confirmation mutually exclusive so only one destructive surface can be open at a time

## 2. Confirmation Surface Implementation

- [x] 2.1 Implement the lightweight single-session confirmation surface in the history rail with session-identifying context and the destructive label `删除会话`
- [x] 2.2 Implement the formal bulk-clear confirmation surface with scoped copy explaining that only historical sessions are cleared and the current session is unaffected
- [x] 2.3 Apply the existing workbench visual tokens and consistent dismiss semantics for both surfaces, including `取消`, click-outside dismiss, and `Esc` close behavior

## 3. Verification

- [x] 3.1 Update `SessionRail` component tests to cover opening, canceling, dismissing, and confirming single-session deletion without issuing accidental requests
- [x] 3.2 Update history-rail tests to cover bulk-clear confirmation copy, confirm/cancel flows, and interaction stability inside the hover/focus-expanded sidebar
