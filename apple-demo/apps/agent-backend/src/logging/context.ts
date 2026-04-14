import { AsyncLocalStorage } from 'node:async_hooks'
import type { RuntimeLogContext } from './types.js'

const runtimeLogContextStorage = new AsyncLocalStorage<RuntimeLogContext>()

export function runWithLogContext<T>(context: RuntimeLogContext, fn: () => T): T {
  return runtimeLogContextStorage.run(context, fn)
}

export function getLogContext(): RuntimeLogContext {
  return runtimeLogContextStorage.getStore() || {}
}
