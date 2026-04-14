import { describe, expect, it } from 'vitest'

import { getConfigLoadDiagnostics } from '../src/config/index.js'
import {
  buildWebBackendFailureDiagnostic,
  buildWebBackendStartupSummary,
  buildWebBackendWarningDiagnostic,
  formatWebBackendFailureDiagnostic,
  formatWebBackendProcessWarning,
  formatWebBackendStartupSummary
} from '../src/startupDiagnostics.js'

describe('web-backend startup diagnostics', () => {
  it('builds a human-readable startup summary without json formatting', () => {
    const summary = buildWebBackendStartupSummary()
    const formatted = formatWebBackendStartupSummary(summary)

    expect(summary.service).toBe('web-backend')
    expect(formatted).toContain('[web-backend] Loaded')
    expect(formatted).toContain(`  config file   : ${summary.configPath}`)
    expect(formatted).toContain(`  listen        : ${summary.baseUrl}`)
    expect(formatted).toContain(`  health        : ${summary.healthEndpoint} ${summary.healthUrl}`)
    expect(formatted).toContain(`  api root      : ${summary.baseUrl}/web/api`)
    expect(formatted).toContain('[web-backend] Ready')
    expect(formatted).not.toContain('{')
  })

  it('reports the shipped config file as the active config source', () => {
    const diagnostics = getConfigLoadDiagnostics()

    expect(diagnostics.configSource).toBe('config.json')
    expect(diagnostics.configPath).toMatch(/apps[\\/]web-backend[\\/]config\.json$/)
  })

  it('formats process warnings with service context and stack text', () => {
    const warning = new Error('SQLite is experimental')
    warning.name = 'ExperimentalWarning'
    const diagnostic = buildWebBackendWarningDiagnostic(warning)

    expect(diagnostic).toMatchObject({
      service: 'web-backend',
      event: 'warning',
      warningName: 'ExperimentalWarning',
      message: 'SQLite is experimental'
    })
    expect(formatWebBackendProcessWarning(diagnostic)).toContain('[web-backend][WARN] ExperimentalWarning')
    expect(formatWebBackendProcessWarning(diagnostic)).toContain('  stack:')
  })

  it('formats fatal diagnostics for startup failures and non-error rejections', () => {
    const startupFailed = buildWebBackendFailureDiagnostic('startup_failed', new Error('boom'))
    expect(startupFailed).toMatchObject({
      service: 'web-backend',
      event: 'startup_failed',
      errorName: 'Error',
      message: 'boom'
    })
    expect(formatWebBackendFailureDiagnostic(startupFailed)).toContain('[web-backend][ERROR] Startup failed')

    const rejection = buildWebBackendFailureDiagnostic('unhandledRejection', 'plain rejection')
    expect(rejection).toMatchObject({
      service: 'web-backend',
      event: 'unhandledRejection',
      message: 'plain rejection'
    })
    expect(formatWebBackendFailureDiagnostic(rejection)).toContain('[web-backend][ERROR] Unhandled rejection')
  })
})
