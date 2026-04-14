## 1. Runtime Message Model

- [x] 1.1 为 session message 引入 short-circuit structured part，并更新 parser、serializer 与 message view builder
- [x] 1.2 让 terminal result builder 与 session history 优先基于 structured part 恢复 protocol / domain-result，而不是依赖 raw text 解析

## 2. Loop And Stream Semantics

- [x] 2.1 重构 `AgentLoopToolRunner` 与 `AgentLoop`，使 short-circuit 结构化输出只落库一条 canonical assistant message，并将正确的 message id 传给 `onAssistantStepComplete`
- [x] 2.2 对齐 `plannerLoop` 的 short-circuit 处理语义，并调整 run success stream 行为，使 protocol / domain-result 不再发送 raw JSON assistant text delta/final

## 3. Frontend Structured Convergence

- [x] 3.1 更新 `workbenchStore` 的运行时收敛逻辑，使 protocol / domain-result 在没有 raw text stream 的情况下仍能从 terminal structured result 正确落到消息列表
- [x] 3.2 更新 session reload 与 conversation rendering 逻辑，使 persisted structured messages 优先渲染为协议卡片或 rich result，而不是退回 raw JSON 文本气泡

## 4. Verification

- [x] 4.1 为主 loop、planner loop、session history 与 run stream 补充覆盖 canonical short-circuit message 语义的后端测试
- [x] 4.2 为 workbench 运行时收敛、reload 恢复以及 question / artifact short-circuit 场景补充前端测试，验证不再出现 raw JSON 文本气泡
