## 1. Backend upload boundary fix

- [x] 1.1 在 `apps/agent-backend/src/routes/files.ts` 为工作区上传使用的 `multer` 显式配置 UTF-8 文件名参数解码，并保持现有扩展名校验与 scope 逻辑不变
- [x] 1.2 确认上传响应、workspace metadata 和打开文件 payload 继续复用现有文件名透传链路，不为历史乱码文件增加迁移或静默修复分支

## 2. Regression coverage

- [x] 2.1 在 `apps/agent-backend/tests/files.routes.test.ts` 增加中文文件名上传回归测试，覆盖 upload response、workspace 列表和后续打开文件返回值
- [x] 2.2 运行受影响的 `agent-backend` 测试并确认 UTF-8 文件名上传链路通过
