## 1. Interaction Persistence And API

- [x] 1.1 为 `agent-backend` 增加持久化 interaction schema、store 接口与 SQLite 读写逻辑，支持按 session 查询 `pending/answered/rejected` question interaction
- [x] 1.2 新增 question interaction 的 authenticated list/reply/reject backend 路由与类型契约，并补齐答案校验与状态流转测试

## 2. Runtime Loop Refactor

- [x] 2.1 重构 `local:question`、`AgentLoop`、`ChatOrchestrator` 与 `RunExecution`，将 question 流改为显式 `awaiting-interaction` outcome 与 continuation context
- [x] 2.2 调整 run lifecycle、terminal result 和日志语义，使 continuation run 在同一 `sessionId` 中继续并保留 interaction 关联信息
- [x] 2.3 移除 `local:write`、`local:run_command` 等普通工具的隐式 structured short-circuit 终态判定，仅保留显式 final structured output 路径

## 3. Workbench Interaction Runtime

- [x] 3.1 为 `apps/web` 增加 pending interaction API 调用、session 级恢复逻辑与问题交互状态管理
- [x] 3.2 将 question 提交流程从 `question_response -> runConversationInput()` 切换为 interaction reply/reject + continuation run，并保持 planner/workbook protocol 流不回退
- [x] 3.3 更新会话页面的问题展示与收敛逻辑，使刷新和后端重启后都能恢复 pending question，且不再渲染 protocol question 气泡或原始回答 payload

## 4. Verification

- [x] 4.1 为 backend 补充 interaction persistence、reply validation、continuation run、backend restart 恢复、以及 ordinary tool non-terminal 语义测试
- [x] 4.2 为 frontend 补充 pending question 恢复、回答/拒绝流程、continuation run 收敛、以及“回答 payload 不作为普通聊天气泡回放”的测试
