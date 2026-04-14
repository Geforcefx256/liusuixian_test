## Context

当 agent run 以 `awaiting-interaction` 结束时，前端在 SSE handler `handleStreamEvent` 中记录等待中消息的 `assistantMessageId`，以便用户回答后精确更新该消息的 header overlay。v1 将此 ID 存入 `SessionActivityViewState`，但 `sessionActivityById` 会被 `refreshSessions()` → `syncSessionRuntimeFromSessions()` 整体覆盖（数据来源是 session list API，不含 `awaitingAssistantMessageId`），导致 ID 丢失。

### 数据流（v1 失败路径）

```
handleStreamEvent(run.completed, awaiting-interaction)
  │  setSessionActivity({ awaitingAssistantMessageId: 108 })  ← 写入
  ▼
runStream resolves
  │
  ▼  refreshSessions() → syncSessionRuntimeFromSessions()
     sessionActivityById.value = { [sid]: { active, state, runId } }  ← 覆盖，ID 丢失
  │
  ▼  ... 用户操作 ...
  │
  ▼  replyPendingInteraction()
     activity.awaitingAssistantMessageId → undefined  ← 读不到，overlay 不更新
```

## Goals / Non-Goals

**Goals:**

- 修复回答/拒绝 askQuestion 后消息 header 从"等待你确认"更新为"已回答"或"任务已结束"
- 存储机制不受 `syncSessionRuntimeFromSessions` 覆盖影响

**Non-Goals:**

- 不处理页面刷新/会话切换后 overlay 持久化（已有 `clearAssistantHeaderOverlays` 策略，刷新后消息无 header 是已知行为）
- 不修改 session list API 响应结构
- 不修改后端逻辑

## Decisions

### 1. 使用独立 ref 存储等待中消息 ID

新增 `awaitingQuestionMessageIdBySession: Ref<Record<string, number>>`，与 `sessionActivityById` 完全解耦。

```
awaitingQuestionMessageIdBySession = ref<Record<string, number>>({})
```

写入点：`handleStreamEvent` → `run.completed` + `awaiting-interaction`
读取点：`replyPendingInteraction` / `rejectPendingInteraction`
清除点：读取后立即清除对应 sessionId 条目；`clearAssistantHeaderOverlays()` 时同步清空

辅助函数：

```typescript
function setAwaitingQuestionMessageId(sessionId: string, messageId: number): void {
  awaitingQuestionMessageIdBySession.value = {
    ...awaitingQuestionMessageIdBySession.value,
    [sessionId]: messageId
  }
}

function consumeAwaitingQuestionMessageId(sessionId: string): number | null {
  const id = awaitingQuestionMessageIdBySession.value[sessionId]
  if (!id) return null
  const next = { ...awaitingQuestionMessageIdBySession.value }
  delete next[sessionId]
  awaitingQuestionMessageIdBySession.value = next
  return id
}
```

### 2. `rememberAssistantHeaderOverlay` 内聚即时更新

`rememberAssistantHeaderOverlay` 在更新 overlay ref 后，自动调用 `updateDisplayedMessage` 将 header 应用到当前已渲染的 message 对象。

```typescript
function rememberAssistantHeaderOverlay(
  messageId: number | undefined,
  assistantHeader: UiAssistantHeader | null
): void {
  if (!assistantHeader || !isPersistedMessageId(messageId)) return
  assistantHeaderOverlays.value = {
    ...assistantHeaderOverlays.value,
    [String(messageId)]: assistantHeader
  }
  // 立即更新已渲染的 message 对象，使 header 变更不依赖 reloadSessionState
  updateDisplayedMessage(
    `persisted-${messageId}`,
    message => ({ ...message, assistantHeader })
  )
}
```

原因：`assistantHeader` 在 `buildPersistedMessageBase` 时被烘焙进 message 对象，是静态值而非响应式绑定。仅更新 overlay ref 不会改变已渲染 message 的 header，必须等到 `mapSessionHistory` 重建消息时才生效。在 `replyPendingInteraction` 中，`rememberAssistantHeaderOverlay` 和 `reloadSessionState` 之间隔着一整个 `runConversationInput`（可能持续数秒到数分钟），导致用户提交回答后"已回答"标签延迟显示。

对现有调用点的影响：
- `applyRunResultToDisplayedMessage`：已在调用前执行了 `updateDisplayedMessage`，内部再次更新是等价冗余，无害
- `replyPendingInteraction`：**修复目标**——提交回答后立即显示"已回答"
- `rejectPendingInteraction`：拒绝后立即显示"任务已结束"（原本有轻微延迟）

### 3. 在 `clearAssistantHeaderOverlays` 时同步清空

`clearAssistantHeaderOverlays()` 在会话切换和全局重置时调用。此时 overlay 全部清除，等待中消息 ID 也无意义，同步清空以避免跨会话误用。

### 4. 移除 v1 残留字段

删除 `SessionActivityViewState.awaitingAssistantMessageId`、`IDLE_SESSION_ACTIVITY` 无需变更（本来就没有该字段默认值）、`run.completed` handler 和 reply/reject 中的旧读写代码。

### 数据流（v2 修复后）

```
handleStreamEvent(run.completed, awaiting-interaction)
  │  setAwaitingQuestionMessageId(sessionId, 108)  ← 写入独立 ref
  ▼
runStream resolves
  │
  ▼  refreshSessions() → syncSessionRuntimeFromSessions()
     sessionActivityById.value = { ... }  ← 覆盖 activity，但独立 ref 不受影响
  │
  ▼  ... 用户操作 ...
  │
  ├─── 回答 ──────────────────────────────────────────────┐
  │  replyPendingInteraction()                             │
  │    consumeAwaitingQuestionMessageId(sid) → 108         │
  │    rememberAssistantHeaderOverlay(108,                  │
  │      ANSWERED_ASSISTANT_HEADER)                         │
  │      → overlays["108"] = "已回答"                       │
  │      → updateDisplayedMessage("persisted-108",          │
  │          header → "已回答") ← 立即生效 ✅               │
  │    await runConversationInput(...)  ← 新 run 期间      │
  │      message 108 已经显示"已回答" ✅                    │
  │                                                         │
  ├─── 拒绝 ──────────────────────────────────────────────┐
  │  rejectPendingInteraction()                            │
  │    consumeAwaitingQuestionMessageId(sid) → 108         │
  │    rememberAssistantHeaderOverlay(108,                  │
  │      REJECTED_QUESTION_ENDED_ASSISTANT_HEADER)          │
  │      → overlays["108"] = "任务已结束"                   │
  │      → updateDisplayedMessage("persisted-108",          │
  │          header → "任务已结束") ← 立即生效 ✅           │
  │                                                         │
  ▼                                                         ▼
reloadSessionState() → mapSessionHistory()
  → resolveAssistantHeaderOverlay(108)
  → 返回更新后的 header（一致性确认） ✅
```

## Risks / Trade-offs

- **页面刷新后 ID 丢失**：独立 ref 与 overlay 一样是内存态，刷新后为空。此时消息无 header（而非显示旧 header），与已有行为一致，可接受。
- **多 question 连续触发**：每个 session 只保留最后一个 `awaitingAssistantMessageId`。如果同一 session 连续两次 `awaiting-interaction`（不回答第一个就触发第二个），第一个的 ID 会被覆盖。实际上后端不允许在有 pending interaction 时发起新 run，所以此场景不会发生。
