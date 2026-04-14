export const QUEUED_STATUS_MESSAGE = '排队中，等待工具完成。'
export const QUEUED_DROP_MESSAGE = '工具执行失败，已丢弃排队消息。'
export const RUN_CANCELLED_MESSAGE = 'Request cancelled'

export const DEFAULT_CONTEXT_AUTO = true
export const DEFAULT_CONTEXT_PRUNE = true
export const DEFAULT_SUMMARY_MAX_TOKENS = 512
export const DEFAULT_CONTEXT_LOG_DETAIL = true

export const DEFAULT_CONTEXT_CONFIG = Object.freeze({
  auto: DEFAULT_CONTEXT_AUTO,
  prune: DEFAULT_CONTEXT_PRUNE,
  summaryMaxTokens: DEFAULT_SUMMARY_MAX_TOKENS,
  logDetail: DEFAULT_CONTEXT_LOG_DETAIL
})

export const MIN_DURATION_MS = 0
export const ZERO = 0
export const MILLISECONDS_PER_SECOND = 1000
export const TIME_DECIMALS = 3
