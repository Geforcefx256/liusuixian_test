import type { ToolRetryHint, ToolStopReason } from './toolFailurePolicy.js'

export function buildToolFailureStatus(params: {
  displayName: string
  toolKind: 'skill' | 'tool'
  retryHint?: ToolRetryHint
}): {
  statusMessage: string
  recoveryMode: 'retrying' | 'recovering'
} {
  const subject = params.toolKind === 'skill'
    ? `Skill ${params.displayName}`
    : `工具 ${params.displayName}`
  if (params.retryHint === 'retry') {
    return {
      statusMessage: `${subject} 暂时失败，正在重试。`,
      recoveryMode: 'retrying'
    }
  }
  return {
    statusMessage: `${subject} 执行失败，正在修正后重试。`,
    recoveryMode: 'recovering'
  }
}

export function resolvePlannerToolStopReason(recoveryActive: boolean): ToolStopReason {
  return recoveryActive ? 'model_recovery_exhausted' : 'tool_terminal'
}
