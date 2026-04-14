## 1. Backend Contract

- [x] 1.1 在 `agent-backend` 的 session store 与 service 层增加“按 user + agent 批量删除历史 session，并排除指定 sessionId”的能力，确保 messages、summaries、plans、interactions 和 session metadata 一并清理。
- [x] 1.2 在 `apps/agent-backend/src/routes/agent.ts` 暴露显式的历史清空接口，并返回删除数量与保留的 `excludedSessionId`。
- [x] 1.3 为批量清空接口补充后端测试，覆盖“排除当前会话”“无排除时清空全部”“关联持久化状态同步删除”等场景。

## 2. Workbench UI

- [x] 2.1 在 `SessionRail` 展开头部增加 `⋯` 更多菜单入口，并提供 `清空历史会话` 次级危险操作，不与“新建会话”并列为同权重主按钮。
- [x] 2.2 在 `workbenchStore` 和前端 API 层接入批量清空调用，限定清空范围为当前助手下除当前会话之外的 persisted sessions，并在成功后保持当前会话选中。
- [x] 2.3 增加确认文案、可清空数量提示、空状态禁用和运行中禁用反馈，明确说明“当前会话不会受影响”。

## 3. Verification

- [x] 3.1 为 `SessionRail` 与 `workbenchStore` 增加前端测试，覆盖菜单显隐、不可用态、确认后列表更新和当前会话保持不变。
- [x] 3.2 运行与本变更相关的前后端测试，确认单条删除、历史清空和当前会话状态恢复行为没有回归。
