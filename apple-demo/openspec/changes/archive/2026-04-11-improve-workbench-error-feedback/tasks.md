## 1. 后端运行时错误契约扩展

- [x] 1.1 在 `apps/agent-backend` 梳理现有 `RuntimeError` 与 tool failure 相关字段，统一用户摘要与技术详情的边界
- [x] 1.2 扩展运行流事件定义，新增可表达“tool 失败但正在恢复 / 重试”的结构化过程事件
- [x] 1.3 调整 runtime error builder 与 tool failure 路径，确保终态 tool 失败包含稳定的 `toolName`、`stopReason`、`normalizedCode` 等结构化元数据
- [x] 1.4 补充后端单元测试，覆盖模型超时、流中断、tool 恢复中、tool 终态失败和取消等错误映射场景

## 2. 前端类型与工作台错误反馈改造

- [x] 2.1 在 `apps/web/src/api/types.ts` 与相关 API 层补齐前端缺失的 runtime error / tool failure 字段与事件类型
- [x] 2.2 更新 `workbenchStore` 的流式事件处理，区分 tool 恢复中状态与终态失败状态，避免将恢复中事件渲染成终态错误卡片
- [x] 2.3 调整对话错误卡片与 assistant header 渲染，只默认展示用户摘要，将技术详情改为可选披露
- [x] 2.4 为终态错误与恢复中状态补充可访问性语义，确保失败提示和状态更新可被辅助技术正确播报

## 3. 验证与回归

- [x] 3.1 在前端 store 与会话组件测试中补充模型超时、tool 恢复中、tool 终态失败的显示断言
- [x] 3.2 运行与 `apps/agent-backend` 错误映射、`apps/web` workbench store、`ConversationPane` 相关的自动化测试集
- [x] 3.3 手工验证一次真实对话链路，确认模型超时不再直接暴露原始细节，tool 失败过程在工作台中有明确状态反馈
