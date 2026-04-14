import type { AgentLoopToolCall } from './loopTypes.js'

export const TOOL_ERROR_CODE = 'tool_execution_failed'
export const QUESTION_VALIDATION_ERROR_CODE = 'question_validation_error'

export interface ToolFailureOutcome {
  code: string
  recoverable: boolean
}

export function resolveToolFailureOutcome(
  toolCall: AgentLoopToolCall,
  errorType: string,
  recoveryActive: boolean
): ToolFailureOutcome {
  return {
    code: resolveToolErrorCode(toolCall, errorType),
    recoverable: !recoveryActive
  }
}

function resolveToolErrorCode(toolCall: AgentLoopToolCall, errorType: string): string {
  if (toolCall.name === 'local:question' && errorType === 'VALIDATION_ERROR') {
    return QUESTION_VALIDATION_ERROR_CODE
  }
  return TOOL_ERROR_CODE
}
