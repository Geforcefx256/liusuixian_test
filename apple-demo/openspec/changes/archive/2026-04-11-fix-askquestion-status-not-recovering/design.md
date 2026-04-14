## Design

### 核心思路

在 `SessionActivityViewState` 中增加 `awaitingAssistantMessageId` 字段，在 run 以 `awaiting-interaction` 结束时记录对应的持久化消息 ID，用户回答或拒绝时通过该 ID 精确更新 `assistantHeaderOverlays`。

### 数据流

```
run.completed (awaiting-interaction)
     │
     │  event.result.assistantMessageId = 42
     │
     ▼
setSessionActivity(sessionId, {
  active: true,
  state: 'awaiting-question',
  runId: null,
  awaitingAssistantMessageId: 42       ◄── 新增
})
     │
     │  ... 用户操作 ...
     │
     ├─── 回答 ───────────────────────────────────────┐
     │  replyPendingInteraction()                      │
     │    activity.awaitingAssistantMessageId → 42     │
     │    rememberAssistantHeaderOverlay(42,            │
     │      ANSWERED_ASSISTANT_HEADER)                  │
     │    → overlays["42"] = "已回答"                   │
     │                                                  │
     ├─── 拒绝 ───────────────────────────────────────┐
     │  rejectPendingInteraction()                     │
     │    activity.awaitingAssistantMessageId → 42     │
     │    rememberAssistantHeaderOverlay(42,            │
     │      REJECTED_QUESTION_ENDED_ASSISTANT_HEADER)   │
     │    → overlays["42"] = "任务已结束"               │
     │                                                  │
     ▼                                                  ▼
reloadSessionState() → mapSessionHistory()
  → resolveAssistantHeaderOverlay(42)
  → 返回更新后的 header ✅
```

### 设计决策

1. **为什么用 activity 而非遍历 overlays？**
   多用户并发场景下，`assistantHeaderOverlays` 是全局 map，遍历查找 label === "等待你确认" 可能误改其他会话的消息。通过 `sessionActivityById[sessionId]` 精确关联，每个 session 独立维护，不会串。

2. **为什么用 `event.result.assistantMessageId` 而非 `context.assistantMessageId`？**
   `context.assistantMessageId` 是前端本地 ID（string，如 `"local-assistant-xxx"`），而 `rememberAssistantHeaderOverlay` 以后端持久化 ID（number）为 key。`event.result.assistantMessageId` 是 `AgentRunResult` 中的持久化 ID，类型和用途完全匹配。

3. **回答后标签文案**
   - 回答：新增 `ANSWERED_ASSISTANT_HEADER`，label = "已回答"，tone = "summary"
   - 拒绝：复用已有 `REJECTED_QUESTION_ENDED_ASSISTANT_HEADER`，label = "任务已结束"

### 改动范围

仅 `apps/web/src/stores/workbenchStore.ts`，纯前端修改，5 处改动点。
