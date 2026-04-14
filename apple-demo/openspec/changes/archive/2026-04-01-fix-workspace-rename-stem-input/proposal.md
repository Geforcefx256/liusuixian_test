## Why

当前工作区文件重命名虽然在后端只允许保留原扩展名，但前端仍向用户展示并回传完整文件名。这会让用户误以为后缀也可以编辑，造成错误预期和无效操作。

## What Changes

- 调整工作区文件重命名交互，只允许用户编辑文件名主体，不直接编辑扩展名。
- 在重命名提示或输入界面中显式保留原扩展名，避免用户误解重命名能力边界。
- 前端在提交重命名请求前，将用户输入的文件名主体与原扩展名重新组合为完整文件名。
- 更新相关前端测试和规格，确保重命名语义与后端约束保持一致。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: workspace 文件重命名的用户交互和提交语义改为“仅编辑文件名主体，保留原扩展名”。

## Impact

- Affected code: `apps/web/src/stores/workbenchStore.ts` 及相关 workbench 组件与测试
- APIs: 不修改现有重命名接口契约，仍向后端提交完整文件名
- Dependencies: 无新增第三方依赖
- Systems: 前端工作区文件重命名流程，与现有 `agent-backend` 扩展名校验保持一致
