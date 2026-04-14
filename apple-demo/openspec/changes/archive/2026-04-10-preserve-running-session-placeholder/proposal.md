## Why

当用户在 `sessionA` 发送第一条消息后快速切换到 `sessionB`，再切回仍在运行中的 `sessionA` 时，当前工作台会先展示只有用户输入的对话历史，运行中的 assistant 气泡要等到后端历史再次同步后才出现。这个短暂空窗会让用户误以为旧会话没有继续执行，破坏多会话切换时的连续性和可信度。

这个问题已经有明确复现路径，且根因位于前端会话水合与本地流式占位消息的收敛逻辑，适合通过一次小范围行为修复消除。

## What Changes

- 调整工作台会话切换时的历史水合逻辑，在会话仍处于运行中的情况下保留本地未持久化的 assistant 占位气泡。
- 在服务端历史追平后，将本地运行中占位气泡与持久化 assistant 消息正确收敛，避免重复气泡或状态倒退。
- 为快速 `A -> B -> A` 切换、运行结束、停止中等场景补充回归测试，确保多会话流式状态恢复稳定。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: workbench session switching must preserve the visible running assistant placeholder for an active session until authoritative persisted assistant history is available.

## Impact

- Affected spec: `openspec/specs/agent-web-workbench/spec.md`
- Affected frontend runtime: `apps/web/src/stores/workbenchStore.ts`
- Affected frontend tests: `apps/web/src/stores/workbenchStore.test.ts`
- No backend API or dependency changes are required for this change.
