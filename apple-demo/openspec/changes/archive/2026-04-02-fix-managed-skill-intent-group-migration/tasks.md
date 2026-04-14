## 1. Backend intent-group normalization and migration

- [x] 1.1 Extract a shared managed-skill `intentGroup` definition/parser so registry load/update and admin routes use the same valid-value contract.
- [x] 1.2 Extend managed skill registry load/initialize flow to detect legacy invalid `intentGroup` values, migrate them to the current default group when defined, and clear them to ungrouped when no current mapping exists.
- [x] 1.3 Persist repaired managed skill records back to `managed-skills.json` after migration and emit explicit diagnostics for repaired legacy values.

## 2. Admin save-path recovery

- [x] 2.1 Update the admin skill save path to ensure repaired or unknown `intentGroup` values never round-trip back to the backend as invalid payload data.
- [x] 2.2 Update `AdminSkillManagement` form state to render legacy invalid `intentGroup` values as `未分组` and show explicit remediation guidance when such data is encountered.

## 3. Regression coverage

- [x] 3.1 Add backend tests covering legacy `intentGroup` migration, fallback-to-default vs clear-to-ungrouped behavior, and registry persistence after repair.
- [x] 3.2 Add route/frontend tests covering successful save after legacy-value remediation and ensuring the management UI never resubmits an unknown `intentGroup`.
