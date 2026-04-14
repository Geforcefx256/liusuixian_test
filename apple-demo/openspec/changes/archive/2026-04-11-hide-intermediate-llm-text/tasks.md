## 1. 后端类型层

- [x] 1.1 在 `sessionStoreTypes.ts` 中新增 `AgentSessionIntermediateMessageAttributes` 接口（`{ visibility: 'internal', semantic: 'intermediate', toolDisplayNames: string[] }`），并将其加入 `AgentSessionMessageAttributes` 联合类型
- [x] 1.2 在 `sessionStoreTypes.ts` 中扩展 `AgentSessionMessageView.kind` 为 `'text' | 'protocol' | 'result' | 'tool-step'`，新增可选字段 `toolDisplayNames?: string[]`

## 2. 后端消息识别与工厂

- [x] 2.1 在 `sessionMessages.ts` 中新增 `isIntermediateMessage(message)` 函数，检查 `attributes?.semantic === 'intermediate'`
- [x] 2.2 在 `sessionMessages.ts` 中新增 `createIntermediateAttributes(toolDisplayNames: string[])` 工厂函数
- [x] 2.3 扩展 `describeHiddenMessageAttributes` 使其也能描述 `intermediate` 类型的 attributes（用于日志输出）

## 3. 后端序列化层

- [x] 3.1 扩展 `sessionStoreUtils.ts` 中的 `parseMessageAttributes` 函数，新增对 `visibility: 'internal'` + `semantic: 'intermediate'` 的解析分支，包含 `toolDisplayNames` 数组的校验和过滤

## 4. 后端执行层

- [x] 4.1 在 `agentLoop.ts` 的 `AgentLoop` 类中新增 `displayNameResolver` 私有字段，从构造函数的 `options` 中获取并持有引用
- [x] 4.2 将 `appendAssistantMessage` 的第三参数从 `createdAt = Date.now()` 改为 `options?: { createdAt?: number; attributes?: AgentSessionMessageAttributes }`，更新方法体以适配新签名
- [x] 4.3 在 `agentLoop.ts` Line 142 处（中间消息保存点），从 `toolExecution.toolParts` 中提取 tool names，通过 `displayNameResolver` 解析为 displayNames，传入 `createIntermediateAttributes(displayNames)` 作为 attributes

## 5. 后端 View 层

- [x] 5.1 在 `sessionStore.ts` 的 `buildMessageView` 函数中，在 `isHiddenSessionMessage` 检查之后新增 `isIntermediateMessage` 分支，返回 `{ kind: 'tool-step', toolDisplayNames, text: '', ... }`

## 6. 前端 API 类型

- [x] 6.1 在 `apps/web/src/api/types.ts` 中扩展 `AgentSessionMessageView`，kind 加 `'tool-step'`，新增 `toolDisplayNames?: string[]`

## 7. 前端 Store 层

- [x] 7.1 在 `workbenchStore.ts` 中新增 `UiToolStepMessage` 接口（`{ id, messageId, role: 'assistant', kind: 'tool-step', status: 'done', toolDisplayNames: string[], createdAt }`）
- [x] 7.2 将 `UiToolStepMessage` 加入 `UiMessage` 联合类型
- [x] 7.3 在 `mapPersistedMessage` 函数中新增 `kind === 'tool-step'` 分支，映射为 `UiToolStepMessage`

## 8. 前端展示层

- [x] 8.1 在 `conversationDisplay.ts` 中扩展分组判断函数，使 `tool-step` 消息也参与连续 assistant 消息的分组收集
- [x] 8.2 扩展 `AssistantProcessDisplayItem.collapsedSteps` 类型为 `Array<(UiTextMessage & ...) | UiToolStepMessage>`
- [x] 8.3 在分组逻辑中添加约束：segment 最后一条必须是 `kind: 'text'` 才创建 process group，否则各消息独立展示
- [x] 8.4 在 `AssistantProcessGroup.vue` 中为 `collapsedSteps` 添加 `tool-step` 渲染分支：遍历 `toolDisplayNames`，每个 displayName 渲染为独立行（`○ displayName`）

## 9. 验证

- [x] 9.1 类型检查通过（`pnpm type-check`）
- [x] 9.2 现有测试通过（`pnpm test`）
