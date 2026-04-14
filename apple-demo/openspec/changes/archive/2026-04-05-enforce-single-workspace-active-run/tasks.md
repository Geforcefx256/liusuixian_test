## 1. Backend Workspace Occupancy

- [x] 1.1 Replace session-scoped run admission with `user + agent` workspace occupancy enforcement and explicit conflict responses for blocked second runs
- [x] 1.2 Keep workspace occupancy active through unresolved pending questions and reject session delete / bulk-clear requests while the workspace remains occupied
- [x] 1.3 Remove disconnect-driven implicit cancellation and expose recoverable workspace-occupancy metadata from runtime bootstrap

## 2. Frontend State Model

- [x] 2.1 Refactor the workbench store to separate workspace-level occupancy state from session-level message, error, status, and pending-interaction state
- [x] 2.2 Route stream updates, stop ownership, and unlock transitions by owning session id instead of the currently active session view
- [x] 2.3 Restore shared-workspace occupancy correctly during initialization, refresh recovery, and session switching

## 3. Workbench Interaction Updates

- [x] 3.1 Update the composer so secondary sessions remain draft-editable but cannot send while another session owns the shared workspace
- [x] 3.2 Update history-rail actions to show the run-owning session and keep delete / bulk-clear actions unavailable while the shared workspace is occupied
- [x] 3.3 Rename the workspace surface to `共享工作区` and add hover/focus help for shared-workspace and locked-action explanations without adding persistent banners or toasts

## 4. Verification

- [x] 4.1 Add backend tests for workspace-scoped run conflicts, pending-question occupancy, disconnect persistence, and destructive-history conflict responses
- [x] 4.2 Add frontend store and component tests for switching sessions during a run, creating draft sessions while occupied, silent unlock after completion, and hover/focus lock explanations

## 5. Regression Follow-up

- [x] 5.1 Split shared-workspace lock copy by composer vs. history context so the composer no longer mentions unrelated destructive actions
- [x] 5.2 Persist composer drafts in the workbench store so blank drafts and session drafts survive session switching while shared-workspace send remains locked
