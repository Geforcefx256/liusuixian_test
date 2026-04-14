## 1. Shared Newline Semantics

- [x] 1.1 提取并复用共享换行规范化 helper，使 `read_file` 与 `edit` 基于同一 LF 文本视图工作
- [x] 1.2 在 `edit` 读取路径中增加主换行风格识别与恢复逻辑，确保写回时保持目标文件风格

## 2. Edit Flow Updates

- [x] 2.1 调整 `editFile.ts` 的匹配、计数与替换流程，使其在规范化视图上处理 `old_string` 和 `new_string`
- [x] 2.2 保持现有 `summary`、路径语义与替换计数返回格式不变，并明确混合换行文件按主风格写回

## 3. Regression Coverage

- [x] 3.1 在 `localProvider.test.ts` 中增加 CRLF 文件经 `read_file` 后多行 `edit` 成功的回归测试
- [x] 3.2 增加写回保持 CRLF 与 LF 行为不变的验证，并覆盖删除或多行替换场景
