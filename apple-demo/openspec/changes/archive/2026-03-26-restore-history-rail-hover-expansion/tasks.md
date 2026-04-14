## 1. Session Rail Interaction Model

- [x] 1.1 Update `apps/web/src/components/workbench/SessionRail.vue` so the collapsed left rail opens the expanded history surface on hover from the rail region instead of requiring an explicit click toggle.
- [x] 1.2 Keep the expanded history surface open while the pointer moves between the collapsed rail and the expanded panel, and close it when the user leaves that combined hover zone.
- [x] 1.3 Preserve session search, preview, selection, and delete affordances inside the expanded history surface while removing click-to-open assumptions from the rail UI.

## 2. Tests And Contract Alignment

- [x] 2.1 Update `apps/web/src/components/workbench/SessionRail.test.ts` so it verifies hover-open and leave-close behavior rather than explicit toggle-open behavior.
- [x] 2.2 Add or adjust tests to confirm selecting a session and deleting a session still work correctly from the hover-expanded panel.
- [x] 2.3 Verify the history rail expansion remains overlay-based and does not change the in-flow width contract expected by the workbench shell.
