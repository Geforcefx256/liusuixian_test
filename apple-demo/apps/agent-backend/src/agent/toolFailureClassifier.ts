import type { GatewayInvokeErrorType } from '../gateway/tools/types.js'
import type {
  RuntimeToolPolicy,
  ToolFailureClassification
} from './toolFailurePolicy.js'

const TRANSIENT_ERROR_PATTERN = /timeout|temporar|rate.?limit|429|5\d\d|econnreset|eai_again|service unavailable/i
const FILE_NOT_FOUND_PATTERN = /file not found|path not found|no such file|enoent/i
const DIRECTORY_NOT_FOUND_PATTERN = /parent directory does not exist|no such directory|directory not found/i
const INVALID_PAYLOAD_PATTERN = /invalid|expected|missing|required|payload|schema/i
const OUTSIDE_WORKSPACE_PATTERN = /outside workspace/i
const UNKNOWN_FILE_KEY_PATTERN = /unknown file key/i
const UNTERMINATED_QUOTES_PATTERN = /unterminated quotes/i

interface ToolFailureClassifierParams {
  toolName: string
  errorType: GatewayInvokeErrorType
  message: string
  toolPolicy: RuntimeToolPolicy
}

export function classifyToolFailure(
  params: ToolFailureClassifierParams
): ToolFailureClassification {
  const safeToRepeat = params.toolPolicy.idempotent && params.toolPolicy.supportsRuntimeRetry
  if (params.errorType === 'TOOL_DENIED') {
    return terminal('tool_denied', safeToRepeat, 'do_not_retry', resolveDenyOrigin(params.toolName))
  }
  if (params.errorType === 'INVALID_RESULT') {
    return terminal('invalid_tool_result', safeToRepeat)
  }
  if (params.errorType === 'TOOL_NOT_FOUND') {
    return recoverable('tool_not_found', safeToRepeat)
  }
  if (params.errorType === 'VALIDATION_ERROR') {
    return recoverable(resolveValidationCode(params.toolName), safeToRepeat)
  }

  const normalizedMessage = params.message.trim().toLowerCase()
  if (UNKNOWN_FILE_KEY_PATTERN.test(normalizedMessage)) {
    return recoverable('unknown_file_key', safeToRepeat)
  }
  if (UNTERMINATED_QUOTES_PATTERN.test(normalizedMessage)) {
    return recoverable('command_unterminated_quotes', safeToRepeat)
  }
  if (OUTSIDE_WORKSPACE_PATTERN.test(normalizedMessage)) {
    return recoverable('path_outside_workspace', safeToRepeat)
  }
  if (FILE_NOT_FOUND_PATTERN.test(normalizedMessage)) {
    return recoverable('path_not_found', safeToRepeat)
  }
  if (DIRECTORY_NOT_FOUND_PATTERN.test(normalizedMessage)) {
    return recoverable('directory_not_found', safeToRepeat)
  }
  if (INVALID_PAYLOAD_PATTERN.test(normalizedMessage)) {
    return recoverable('invalid_tool_input', safeToRepeat)
  }
  if (params.errorType === 'EXECUTION_TIMEOUT' || TRANSIENT_ERROR_PATTERN.test(normalizedMessage)) {
    if (safeToRepeat) {
      return {
        normalizedCode: 'transient_tool_failure',
        category: 'transient_retryable',
        retryHint: 'retry',
        safeToRepeat: true
      }
    }
    return terminal('execution_timeout', safeToRepeat)
  }

  return terminal(resolveExecutionFailureCode(params.toolName), safeToRepeat)
}

function recoverable(normalizedCode: string, safeToRepeat: boolean): ToolFailureClassification {
  return {
    normalizedCode,
    category: 'model_recoverable',
    retryHint: 'correct_input',
    safeToRepeat
  }
}

function terminal(
  normalizedCode: string,
  safeToRepeat: boolean,
  retryHint: ToolFailureClassification['retryHint'] = 'do_not_retry',
  denyOrigin?: string
): ToolFailureClassification {
  return {
    normalizedCode,
    category: 'terminal',
    retryHint,
    safeToRepeat,
    denyOrigin
  }
}

function resolveValidationCode(toolName: string): string {
  if (toolName === 'local:question') {
    return 'question_validation_error'
  }
  return 'invalid_tool_input'
}

function resolveExecutionFailureCode(toolName: string): string {
  return 'tool_execution_failed'
}

function resolveDenyOrigin(toolName: string): string {
  return toolName.split(':')[0] || 'unknown'
}
