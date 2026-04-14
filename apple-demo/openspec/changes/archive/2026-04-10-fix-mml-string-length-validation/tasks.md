## 1. Backend Length Semantics

- [x] 1.1 Update `apps/web-backend/src/mmlRules/importer.ts` so `类型=字符串` parameters keep `minLength` and `maxLength` but no longer derive `exactLength` from the Excel `长度` column.
- [x] 1.2 Add or update importer tests to cover string rows that include `最大长度`、`最小长度`、`长度`, and confirm the resulting schema leaves `exactLength` empty for string parameters.
- [x] 1.3 Add or update importer tests to cover string rows that only provide the Excel `长度` column, and confirm the importer does not fabricate `minLength` or `maxLength`.

## 2. Frontend Shared Validation

- [x] 2.1 Update `apps/web/src/components/workbench/mmlSemantics.ts` so string parameter validation ignores `exactLength` and only enforces `minLength` / `maxLength`.
- [x] 2.2 Verify the workbook path continues to inherit the same string-length behavior through the shared validation flow in `apps/web/src/components/workbench/mmlWorkbook.ts` without introducing a second validation branch.
- [x] 2.3 Add or update frontend tests to cover historical string schema data that still contains `exactLength`, ensuring text diagnostics and workbook cell validation do not reject values solely for not matching that legacy field.

## 3. Verification

- [x] 3.1 Run the targeted backend MML importer tests and confirm the new string-length import semantics pass.
- [x] 3.2 Run the targeted frontend MML validation tests and confirm both text-view and workbook paths follow the same min/max-only string validation behavior.
