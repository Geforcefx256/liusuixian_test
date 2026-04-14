import {
  getWebBackendStartupConfigDiagnostics,
  type WebBackendStartupConfigDiagnostics
} from './config/index.js'

interface WebBackendLogger {
  log(message: string): void
  warn(message: string): void
  error(message: string): void
}

export interface WebBackendStartupSummary {
  service: 'web-backend'
  protocol: 'http' | 'https'
  host: string
  port: number
  baseUrl: string
  healthEndpoint: 'GET /health'
  healthUrl: string
  configSource: WebBackendStartupConfigDiagnostics['configSource']
  configPath: string
  serviceRoot: string
  hostSource: WebBackendStartupConfigDiagnostics['hostSource']
  portSource: WebBackendStartupConfigDiagnostics['portSource']
  sqliteDataPath: string
  mmlRules: {
    sourceDir: string
    dbPath: string
    importOnStartup: boolean
    failOnStartupImportError: boolean
  }
  auth: {
    mode: string
    sameOriginProtectionEnabled: boolean
    allowedOrigins: string[]
    refreshWindowMs: number
    oauthLogsEnabled: boolean
    oauthClientConfigured: boolean
    oauthTokenEncryptionKeyConfigured: boolean
  }
}

export interface WebBackendProcessDiagnostic {
  service: 'web-backend'
  event: string
  errorName?: string
  warningName?: string
  message: string
  stack?: string
}

export function buildWebBackendStartupSummary(
  diagnostics: WebBackendStartupConfigDiagnostics = getWebBackendStartupConfigDiagnostics()
): WebBackendStartupSummary {
  const protocol = diagnostics.server.httpsEnabled ? 'https' : 'http'
  const baseUrl = `${protocol}://${diagnostics.server.host}:${diagnostics.server.port}`
  return {
    service: 'web-backend',
    protocol,
    host: diagnostics.server.host,
    port: diagnostics.server.port,
    baseUrl,
    healthEndpoint: 'GET /health',
    healthUrl: `${baseUrl}/health`,
    configSource: diagnostics.configSource,
    configPath: diagnostics.configPath,
    serviceRoot: diagnostics.serviceRoot,
    hostSource: diagnostics.hostSource,
    portSource: diagnostics.portSource,
    sqliteDataPath: diagnostics.sqliteDataPath,
    mmlRules: {
      sourceDir: diagnostics.mmlRules.sourceDir,
      dbPath: diagnostics.mmlRules.dbPath,
      importOnStartup: diagnostics.mmlRules.importOnStartup,
      failOnStartupImportError: diagnostics.mmlRules.failOnStartupImportError
    },
    auth: {
      mode: diagnostics.auth.mode,
      sameOriginProtectionEnabled: diagnostics.auth.sameOriginProtectionEnabled,
      allowedOrigins: [...diagnostics.auth.allowedOrigins],
      refreshWindowMs: diagnostics.auth.refreshWindowMs,
      oauthLogsEnabled: diagnostics.auth.oauthLogsEnabled,
      oauthClientConfigured: diagnostics.auth.oauthClientConfigured,
      oauthTokenEncryptionKeyConfigured: diagnostics.auth.oauthTokenEncryptionKeyConfigured
    }
  }
}

export function buildWebBackendWarningDiagnostic(warning: Error): WebBackendProcessDiagnostic {
  return {
    service: 'web-backend',
    event: 'warning',
    warningName: warning.name || 'Warning',
    message: warning.message,
    stack: warning.stack
  }
}

export function buildWebBackendFailureDiagnostic(
  event: 'startup_failed' | 'unhandledRejection' | 'uncaughtException',
  error: unknown
): WebBackendProcessDiagnostic {
  const normalized = normalizeError(error)
  return {
    service: 'web-backend',
    event,
    errorName: normalized.name,
    message: normalized.message,
    stack: normalized.stack
  }
}

export function logWebBackendStartupSummary(
  logger: WebBackendLogger = console,
  summary: WebBackendStartupSummary = buildWebBackendStartupSummary()
): void {
  logger.log(formatWebBackendStartupSummary(summary))
}

export function logWebBackendProcessWarning(
  warning: Error,
  logger: WebBackendLogger = console
): void {
  logger.warn(formatWebBackendProcessWarning(buildWebBackendWarningDiagnostic(warning)))
}

export function logWebBackendFatalDiagnostic(
  event: 'startup_failed' | 'unhandledRejection' | 'uncaughtException',
  error: unknown,
  logger: WebBackendLogger = console
): void {
  logger.error(formatWebBackendFailureDiagnostic(buildWebBackendFailureDiagnostic(event, error)))
}

export function logWebBackendStarting(
  logger: WebBackendLogger = console
): void {
  logger.log('[web-backend] Starting...')
}

export function formatWebBackendStartupSummary(summary: WebBackendStartupSummary): string {
  return [
    '[web-backend] Loaded',
    `  config file   : ${summary.configPath}`,
    `  sqlite dir    : ${summary.sqliteDataPath}`,
    `  mml rules src : ${summary.mmlRules.sourceDir}`,
    `  mml rules db  : ${summary.mmlRules.dbPath}`,
    '[web-backend] Routes',
    `  listen        : ${summary.baseUrl}`,
    `  health        : ${summary.healthEndpoint} ${summary.healthUrl}`,
    `  api root      : ${summary.baseUrl}/web/api`,
    '[web-backend] Ready'
  ].join('\n')
}

export function formatWebBackendProcessWarning(diagnostic: WebBackendProcessDiagnostic): string {
  const label = diagnostic.warningName || 'Warning'
  return [
    `[web-backend][WARN] ${label}`,
    `  message       : ${diagnostic.message}`,
    ...formatStack(diagnostic.stack)
  ].join('\n')
}

export function formatWebBackendFailureDiagnostic(diagnostic: WebBackendProcessDiagnostic): string {
  return [
    `[web-backend][ERROR] ${formatFailureLabel(diagnostic.event)}`,
    `  message       : ${diagnostic.message}`,
    ...formatStack(diagnostic.stack)
  ].join('\n')
}

function normalizeError(error: unknown): { name?: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }
  return {
    message: String(error)
  }
}

function formatStack(stack?: string): string[] {
  if (!stack) {
    return []
  }
  return [
    '  stack:',
    ...stack.split('\n').map(line => `    ${line}`)
  ]
}

function formatFailureLabel(event: WebBackendProcessDiagnostic['event']): string {
  switch (event) {
    case 'startup_failed':
      return 'Startup failed'
    case 'unhandledRejection':
      return 'Unhandled rejection'
    case 'uncaughtException':
      return 'Uncaught exception'
    default:
      return event
  }
}
