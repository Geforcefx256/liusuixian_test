## 1. 修复 tsx loader 路径

- [x] 1.1 在 `apps/agent-backend/src/runtime/tools/skill/scriptExecutor.ts` 顶部新增 `import { pathToFileURL } from 'node:url'`
- [x] 1.2 修改 `resolveTsxLoaderPath()` 函数，将 `return loaderPath` 改为 `return pathToFileURL(loaderPath).href`

## 2. 验证

- [x] 2.1 运行 `pnpm type-check` 确认无类型错误
- [x] 2.2 运行 `pnpm test` 确认现有测试通过
