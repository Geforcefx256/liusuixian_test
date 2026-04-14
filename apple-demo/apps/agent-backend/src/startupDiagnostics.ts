import type { RuntimeLogger } from './logging/types.js'
import {
  getConfigLoadDiagnostics,
  type Config
} from './memory/ConfigLoader.js'
import { resolveAgentAssetsRoot } from './support/runtimePaths.js'

export interface AgentBackendStartupSummary {
  service: 'agent-backend'
  protocol: 'http' | 'https'
  host: string
  port: number
  baseUrl: string
  healthEndpoint: 'GET /health'
  healthUrl: string
  configSource: 'config.json' | 'defaults'
  configPath: string
  configRoot: string
  portSource: 'env:SERVER_PORT' | 'config.json' | 'defaults'
  authBaseUrl: string
  memoryDbPath: string
  runtimeWorkspaceDir: string
  skillsRoot: string
  agentsManifestPath: string
  managedSkillsPath: string
  managedSkillPackagesDir: string
  fileLoggingDirectory: string
  gatewayToolsConfigSource: string
}

export interface AgentBackendProcessDiagnostic {
  service: 'agent-backend'
  event: string
  errorName?: string
  warningName?: string
  message: string
  stack?: string
}

export function buildAgentBackendStartupSummary(
  config: Config,
  options: {
    gatewayToolsConfigSource: string
    managedSkillsPath: string
    managedSkillPackagesDir: string
    moduleUrl?: string
  }
): AgentBackendStartupSummary {
  const configDiagnostics = getConfigLoadDiagnostics()
  const assetsRoot = resolveAgentAssetsRoot(options.moduleUrl || import.meta.url, 2)
  const protocol = config.server.https?.enabled ? 'https' : 'http'
  const baseUrl = `${protocol}://${config.server.host}:${config.server.port}`
  return {
    service: 'agent-backend',
    protocol,
    host: config.server.host,
    port: config.server.port,
    baseUrl,
    healthEndpoint: 'GET /health',
    healthUrl: `${baseUrl}/health`,
    configSource: configDiagnostics.configSource,
    configPath: configDiagnostics.configPath,
    configRoot: configDiagnostics.configRoot,
    portSource: process.env.SERVER_PORT ? 'env:SERVER_PORT' : configDiagnostics.configSource,
    authBaseUrl: config.auth.baseUrl,
    memoryDbPath: config.memory.dbPath,
    runtimeWorkspaceDir: config.runtime.workspaceDir,
    skillsRoot: assetsRoot,
    agentsManifestPath: `${assetsRoot}/agents/manifest.json`.replace(/\//g, '\\'),
    managedSkillsPath: options.managedSkillsPath,
    managedSkillPackagesDir: options.managedSkillPackagesDir,
    fileLoggingDirectory: config.runtime.fileLogging.directory,
    gatewayToolsConfigSource: options.gatewayToolsConfigSource
  }
}

export function buildAgentBackendWarningDiagnostic(warning: Error): AgentBackendProcessDiagnostic {
  return {
    service: 'agent-backend',
    event: 'warning',
    warningName: warning.name || 'Warning',
    message: warning.message,
    stack: warning.stack
  }
}

export function buildAgentBackendFailureDiagnostic(
  event: 'startup_failed' | 'unhandledRejection' | 'uncaughtException',
  error: unknown
): AgentBackendProcessDiagnostic {
  const normalized = normalizeError(error)
  return {
    service: 'agent-backend',
    event,
    errorName: normalized.name,
    message: normalized.message,
    stack: normalized.stack
  }
}

export function logAgentBackendStartupSummary(
  logger: RuntimeLogger,
  summary: AgentBackendStartupSummary
): void {
  logger.info({
    message: 'backend startup summary',
    data: {
      ...summary
    }
  })
  writeConsole(formatAgentBackendStartupSummary(summary))
}

export function logAgentBackendReady(
  logger: RuntimeLogger,
  summary: AgentBackendStartupSummary,
  readiness: { vectorSearchAvailable: boolean; ftsSearchAvailable: boolean }
): void {
  logger.info({
    message: 'backend service ready',
    data: {
      ...summary,
      ...readiness
    }
  })
  writeConsole('[agent-backend] Ready')
}

export function logAgentBackendProcessWarning(
  logger: RuntimeLogger,
  warning: Error
): void {
  const diagnostic = buildAgentBackendWarningDiagnostic(warning)
  logger.warn({
    message: 'process warning',
    data: {
      ...diagnostic
    }
  })
  writeConsole(formatAgentBackendProcessWarning(diagnostic))
}

export function logAgentBackendFatalDiagnostic(
  logger: RuntimeLogger,
  event: 'startup_failed' | 'unhandledRejection' | 'uncaughtException',
  error: unknown
): void {
  const diagnostic = buildAgentBackendFailureDiagnostic(event, error)
  logger.error({
    message: diagnostic.event,
    data: {
      ...diagnostic
    }
  })
  writeConsole(formatAgentBackendFailureDiagnostic(diagnostic))
}

export function logAgentBackendStarting(
  logger: RuntimeLogger
): void {
  logger.info({ message: 'backend starting' })
  writeConsole('[agent-backend] Starting...')
}

export function formatAgentBackendStartupSummary(summary: AgentBackendStartupSummary): string {
  const apiRoot = `${summary.baseUrl}/agent/api`
  return [
    '[agent-backend] Loaded',
    `  config file        : ${summary.configPath}`,
    `  runtime workspace  : ${summary.runtimeWorkspaceDir}`,
    `  memory db          : ${summary.memoryDbPath}`,
    `  auth base url      : ${summary.authBaseUrl}`,
    `  skills root        : ${summary.skillsRoot}`,
    `  agents manifest    : ${summary.agentsManifestPath}`,
    `  managed skills     : ${summary.managedSkillsPath}`,
    `  managed skill pkgs : ${summary.managedSkillPackagesDir}`,
    `  logs dir           : ${summary.fileLoggingDirectory}`,
    '[agent-backend] Routes',
    `  listen             : ${summary.baseUrl}`,
    `  health             : ${summary.healthEndpoint} ${summary.healthUrl}`,
    `  api root           : ${apiRoot}`
  ].join('\n')
}

export function formatAgentBackendProcessWarning(diagnostic: AgentBackendProcessDiagnostic): string {
  const label = diagnostic.warningName || 'Warning'
  return [
    `[agent-backend][WARN] ${label}`,
    `  message        : ${diagnostic.message}`,
    ...formatStack(diagnostic.stack)
  ].join('\n')
}

export function formatAgentBackendFailureDiagnostic(diagnostic: AgentBackendProcessDiagnostic): string {
  return [
    `[agent-backend][ERROR] ${formatFailureLabel(diagnostic.event)}`,
    `  message        : ${diagnostic.message}`,
    ...formatStack(diagnostic.stack)
  ].join('\n')
}

function writeConsole(message: string): void {
  const stream = message.includes('[ERROR]') ? process.stderr : process.stdout
  stream.write(`${message}\n`)
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

function formatFailureLabel(event: AgentBackendProcessDiagnostic['event']): string {
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
