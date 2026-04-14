import type { RunMetrics } from '../types.js'
import {
  MILLISECONDS_PER_SECOND,
  MIN_DURATION_MS,
  TIME_DECIMALS,
  ZERO
} from './constants.js'
import { createLogger } from '../../logging/index.js'

const runTimingLogger = createLogger({
  category: 'runtime',
  component: 'run_timing'
})

export function buildRunTimingSummary(params: {
  startedAt: number
  endedAt: number
  modelAggregate: { calls: number; latencyMs: number } | null | undefined
  toolMetrics: RunMetrics['tools']
}) {
  const modelMs = params.modelAggregate?.latencyMs ?? ZERO
  const toolMs = sumToolLatency(params.toolMetrics)
  const totalMs = Math.max(MIN_DURATION_MS, params.endedAt - params.startedAt)
  const otherMs = Math.max(MIN_DURATION_MS, totalMs - modelMs - toolMs)

  return {
    modelCostTime: formatSeconds(modelMs),
    toolCostTime: formatSeconds(toolMs),
    otherCostTime: formatSeconds(otherMs),
    costAllTime: formatSeconds(totalMs)
  }
}

export function logRunTimingSummary(summary: ReturnType<typeof buildRunTimingSummary>): void {
  runTimingLogger.info({
    message: 'run timing summary generated',
    data: summary
  })
}

function sumToolLatency(metrics: RunMetrics['tools']): number {
  return metrics.reduce((total, metric) => {
    const latency = Math.max(MIN_DURATION_MS, metric.latencyMs || ZERO)
    return total + latency
  }, ZERO)
}

function formatSeconds(milliseconds: number): string {
  const seconds = milliseconds / MILLISECONDS_PER_SECOND
  return `${seconds.toFixed(TIME_DECIMALS)}s`
}
