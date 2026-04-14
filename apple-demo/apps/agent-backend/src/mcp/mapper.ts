import type { MCPOperation } from './types.js'
import { createLogger } from '../logging/index.js'

const mcpMapperLogger = createLogger({
  category: 'runtime',
  component: 'mcp_mapper'
})

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isOperation(value: unknown): value is MCPOperation {
  if (!isObject(value)) return false
  if (typeof value.type !== 'string') return false
  if (typeof value.sheetName !== 'string') return false
  return ['insert', 'update', 'delete', 'batch'].includes(value.type)
}

export function mapToOperations(payload: unknown): MCPOperation[] {
  if (Array.isArray(payload) && payload.every(item => isOperation(item))) {
    return payload
  }

  if (isOperation(payload)) {
    return [payload]
  }

  if (isObject(payload) && Array.isArray(payload.operations)) {
    const operations = payload.operations.filter(isOperation)
    const skippedCount = payload.operations.length - operations.length
    if (skippedCount > 0) {
      mcpMapperLogger.warn({
        message: 'ignored invalid mcp operations from payload',
        data: { skippedCount }
      })
    }
    return operations
  }

  if (
    isObject(payload) &&
    typeof payload.sheetName === 'string' &&
    Array.isArray(payload.rows)
  ) {
    return [
      {
        type: 'insert',
        sheetName: payload.sheetName,
        rows: payload.rows as Array<Record<string, unknown>>
      }
    ]
  }

  return []
}
