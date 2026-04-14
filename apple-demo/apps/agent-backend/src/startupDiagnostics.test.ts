import { describe, expect, it } from 'vitest'

import { getConfigLoadDiagnostics, loadConfig } from './memory/ConfigLoader.js'
import {
  buildAgentBackendFailureDiagnostic,
  buildAgentBackendStartupSummary,
  buildAgentBackendWarningDiagnostic,
  formatAgentBackendFailureDiagnostic,
  formatAgentBackendProcessWarning,
  formatAgentBackendStartupSummary
} from './startupDiagnostics.js'

describe('agent-backend startup diagnostics', () => {
  it('builds a human-readable startup summary without json formatting', () => {
    const config = loadConfig()
    const summary = buildAgentBackendStartupSummary(config, {
      gatewayToolsConfigSource: 'runtime',
      managedSkillsPath: 'D:\\runtime-data\\managed-skills.json',
      managedSkillPackagesDir: 'D:\\runtime-data\\skills'
    } as any)
    const formatted = formatAgentBackendStartupSummary(summary)

    expect(summary.service).toBe('agent-backend')
    expect(formatted).toContain('[agent-backend] Loaded')
    expect(formatted).toContain(`  config file        : ${summary.configPath}`)
    expect(formatted).toContain(`  runtime workspace  : ${summary.runtimeWorkspaceDir}`)
    expect(formatted).toContain(`  memory db          : ${summary.memoryDbPath}`)
    expect(formatted).toContain(`  agents manifest    : ${summary.agentsManifestPath}`)
    expect(formatted).toContain(`  managed skills     : ${summary.managedSkillsPath}`)
    expect(formatted).toContain('  managed skill pkgs : D:\\runtime-data\\skills')
    expect(formatted).toContain(`  health             : ${summary.healthEndpoint} ${summary.healthUrl}`)
    expect(formatted).toContain('[agent-backend] Routes')
    expect(formatted).not.toContain('{')
  })

  it('reports the shipped config file as the active config source', () => {
    const diagnostics = getConfigLoadDiagnostics()

    expect(diagnostics.configSource).toBe('config.json')
    expect(diagnostics.configPath).toMatch(/apps[\\/]agent-backend[\\/]config\.json$/)
  })

  it('formats process warnings and fatal diagnostics with service context', () => {
    const warning = new Error('fetch failed')
    warning.name = 'ExperimentalWarning'
    const warningDiagnostic = buildAgentBackendWarningDiagnostic(warning)

    expect(warningDiagnostic).toMatchObject({
      service: 'agent-backend',
      event: 'warning',
      warningName: 'ExperimentalWarning',
      message: 'fetch failed'
    })
    expect(formatAgentBackendProcessWarning(warningDiagnostic)).toContain('[agent-backend][WARN] ExperimentalWarning')
    expect(formatAgentBackendProcessWarning(warningDiagnostic)).toContain('  stack:')

    const failure = buildAgentBackendFailureDiagnostic('uncaughtException', new Error('boom'))
    expect(failure).toMatchObject({
      service: 'agent-backend',
      event: 'uncaughtException',
      errorName: 'Error',
      message: 'boom'
    })
    expect(formatAgentBackendFailureDiagnostic(failure)).toContain('[agent-backend][ERROR] Uncaught exception')
  })
})
