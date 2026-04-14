import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveAgentAssetsRoot, resolveBackendRoot, resolveVendoredRipgrepRoot } from './runtimePaths.js'

describe('resolveBackendRoot', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('finds the published backend root when running from published output', () => {
    const moduleUrl = pathToFileURL(join(process.cwd(), 'tmp', 'release', 'agent-backend', 'dist', 'memory', 'ConfigLoader.js')).href

    expect(resolveBackendRoot(moduleUrl, 2).replace(/\\/g, '/')).toMatch(/\/tmp\/release\/agent-backend$/)
  })

  it('resolves source agent assets from the app root in source mode', () => {
    expect(resolveAgentAssetsRoot(import.meta.url, 2).replace(/\\/g, '/')).toMatch(/\/apps\/agent-backend\/assets$/)
  })

  it('resolves source vendored ripgrep assets from the app root in source mode', () => {
    expect(resolveVendoredRipgrepRoot(import.meta.url, 2).replace(/\\/g, '/'))
      .toMatch(/\/apps\/agent-backend\/assets\/vendor\/ripgrep$/)
  })

  it('resolves vendored ripgrep assets from dist output without reading the source tree', async () => {
    const distRoot = await mkdtemp(join(tmpdir(), 'agent-backend-dist-'))
    tempDirs.push(distRoot)
    await mkdir(join(distRoot, 'assets', 'vendor', 'ripgrep'), { recursive: true })
    await writeFile(join(distRoot, 'config.json'), '{}', 'utf8')
    const moduleUrl = pathToFileURL(join(distRoot, 'index.js')).href

    expect(resolveVendoredRipgrepRoot(moduleUrl, 2).replace(/\\/g, '/'))
      .toMatch(/\/agent-backend-dist-.*\/assets\/vendor\/ripgrep$/)
  })
})
