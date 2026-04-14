import { describe, expect, it } from 'vitest'
import { classifyToolFailure } from './toolFailureClassifier.js'

const RETRYABLE_LOCAL_TOOL = {
  idempotent: true,
  supportsRuntimeRetry: true,
  supportsModelRecovery: true
} as const

const NON_IDEMPOTENT_TOOL = {
  idempotent: false,
  supportsRuntimeRetry: false,
  supportsModelRecovery: true
} as const

describe('classifyToolFailure', () => {
  it('keeps local validation failures model-recoverable', () => {
    const result = classifyToolFailure({
      toolName: 'local:question',
      errorType: 'VALIDATION_ERROR',
      message: 'Question tool options must include at least 2 items.',
      toolPolicy: NON_IDEMPOTENT_TOOL
    })

    expect(result).toMatchObject({
      normalizedCode: 'question_validation_error',
      category: 'model_recoverable',
      retryHint: 'correct_input'
    })
  })

  it('normalizes path failures from coarse execution errors', () => {
    const result = classifyToolFailure({
      toolName: 'local:read_file',
      errorType: 'EXECUTION_FAILED',
      message: 'File not found: docs/missing.md. Use find_files if you only know the filename.',
      toolPolicy: RETRYABLE_LOCAL_TOOL
    })

    expect(result).toMatchObject({
      normalizedCode: 'path_not_found',
      category: 'model_recoverable'
    })
  })

  it('treats eligible idempotent timeout failures as transient retryable', () => {
    const result = classifyToolFailure({
      toolName: 'local:read_file',
      errorType: 'EXECUTION_TIMEOUT',
      message: 'tool invocation timeout',
      toolPolicy: RETRYABLE_LOCAL_TOOL
    })

    expect(result).toMatchObject({
      normalizedCode: 'transient_tool_failure',
      category: 'transient_retryable',
      safeToRepeat: true
    })
  })

  it('does not mark non-idempotent governed script failures as runtime-retryable', () => {
    const result = classifyToolFailure({
      toolName: 'skill:exec',
      errorType: 'EXECUTION_TIMEOUT',
      message: 'command timeout',
      toolPolicy: NON_IDEMPOTENT_TOOL
    })

    expect(result).toMatchObject({
      normalizedCode: 'execution_timeout',
      category: 'terminal',
      safeToRepeat: false
    })
  })
})
