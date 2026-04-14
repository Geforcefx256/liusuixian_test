## 1. Composer Feedback Refinement

- [x] 1.1 Remove the send button's running-state `处理中...` label so the button keeps its resting send copy while disabled during active runs.
- [x] 1.2 Update the stop button markup to render an inline pending spinner with a width-stable `停止中` state inside the existing stop control.
- [x] 1.3 Add a danger-tinted secondary style for the stop control that stays visually distinct from both neutral secondary buttons and the primary send CTA.

## 2. Verification

- [x] 2.1 Update conversation-pane component tests to cover the static send label during active runs and the inline spinner stop-pending state.
- [x] 2.2 Verify stop-pending presentation does not introduce an extra composer-level/global status bar and that action-row layout remains stable in the supported viewport range.
