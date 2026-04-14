import type { ToolStopReason } from './toolFailurePolicy.js'
import { extractQuestionReferenceOptions } from '../runtime/tools/local/questionInputNormalization.js'

const DEGRADED_REASON = '结构化问题收集失败，原始选项无法可靠展示。请参考下面的信息手动填写主答案。'

export function shouldDegradeQuestionFailure(params: {
  toolName: string
  normalizedCode: string
  stopReason?: ToolStopReason
}): boolean {
  return params.toolName === 'local:question'
    && params.normalizedCode === 'question_validation_error'
    && params.stopReason === 'model_recovery_exhausted'
}

export function buildQuestionDegradation(params: {
  toolInput: Record<string, unknown>
}): {
  prompt: string
  reason: string
  referenceOptions: string[]
} {
  return {
    prompt: typeof params.toolInput.prompt === 'string' ? params.toolInput.prompt.trim() : '',
    reason: DEGRADED_REASON,
    referenceOptions: extractQuestionReferenceOptions(resolveQuestionReferenceSource(params.toolInput))
  }
}

function resolveQuestionReferenceSource(toolInput: Record<string, unknown>): unknown {
  if (Array.isArray(toolInput.fields)) {
    return toolInput.fields
  }
  return toolInput.options
}
