import { randomUUID } from 'node:crypto'
import { getLogContext } from './context.js'
import { runtimeLogDispatcher } from './runtime.js'
import type {
  RuntimeLogContext,
  RuntimeLogEntry,
  RuntimeLogRecord,
  RuntimeLogger,
  RuntimeLogWrite
} from './types.js'

export function appendRuntimeLog(record: RuntimeLogRecord): void {
  runtimeLogDispatcher.append(buildRuntimeLogEntry(record))
}

export function createLogger(definition: {
  category: RuntimeLogRecord['category']
  component: string
}): RuntimeLogger {
  return {
    info(entry) {
      appendRuntimeLog({
        ...definition,
        ...entry,
        level: 'info'
      })
    },
    warn(entry) {
      appendRuntimeLog({
        ...definition,
        ...entry,
        level: 'warn'
      })
    },
    error(entry) {
      appendRuntimeLog({
        ...definition,
        ...entry,
        level: 'error'
      })
    }
  }
}

function buildRuntimeLogEntry(record: RuntimeLogRecord): RuntimeLogEntry {
  const context = mergeLogContext(getLogContext(), record.context)
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    level: record.level,
    category: record.category,
    component: record.component,
    message: record.message,
    ...context,
    ...(record.data ? { data: { ...record.data } } : {})
  }
}

function mergeLogContext(
  base: RuntimeLogContext,
  override?: RuntimeLogWrite['context']
): RuntimeLogContext {
  if (!override) {
    return base
  }
  return {
    ...base,
    ...override
  }
}
