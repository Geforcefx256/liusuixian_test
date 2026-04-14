const DEFAULT_MAX_LOG_PREVIEW_CHARS = 500

export interface LogPreviewOptions {
  maxChars?: number
  disableTruncation?: boolean
}

export function buildLogPreview(value: string, options: LogPreviewOptions = {}): string {
  if (options.disableTruncation) {
    return value
  }
  const maxChars = options.maxChars ?? DEFAULT_MAX_LOG_PREVIEW_CHARS
  if (value.length <= maxChars) {
    return value
  }
  return `${value.slice(0, maxChars)}...[truncated]`
}
