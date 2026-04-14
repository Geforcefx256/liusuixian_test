## 1. Rename Flow Refactor

- [x] 1.1 Split workbench rename execution from prompt collection so the store accepts an explicit target file name while preserving running/dirty blocking and rename state reconciliation
- [x] 1.2 Remove the remaining browser-prompt-based rename path and update store tests for explicit submit, unchanged submit, blocked rename, and failure preservation

## 2. Sidebar Inline Editing

- [x] 2.1 Add inline rename state to the workspace sidebar so the file-name region can switch between static text and stem-only input with read-only extension display
- [x] 2.2 Implement inline rename keyboard and focus behavior covering autofocus, `Enter` submit, `Escape` cancel, and `blur` submit without double-firing requests
- [x] 2.3 Update component tests for row action isolation, inline rename rendering, and submit/cancel behavior on files with and without extensions
