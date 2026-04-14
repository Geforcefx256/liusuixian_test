import { describe, expect, it } from 'vitest'
import { resolveRipgrepSelection } from './ripgrep.js'

describe('resolveRipgrepSelection', () => {
  it('selects the macOS x64 vendored binary target', () => {
    const selection = resolveRipgrepSelection('/tmp/ripgrep', {
      platform: 'darwin',
      arch: 'x64',
      libc: null
    })

    expect(selection).toMatchObject({
      platform: 'darwin',
      arch: 'x64',
      libc: null,
      target: 'x86_64-apple-darwin'
    })
    expect(normalizePath(selection.binaryPath)).toBe('/tmp/ripgrep/x86_64-apple-darwin/rg')
  })

  it('selects the macOS arm64 vendored binary target', () => {
    const selection = resolveRipgrepSelection('/tmp/ripgrep', {
      platform: 'darwin',
      arch: 'arm64',
      libc: null
    })

    expect(selection).toMatchObject({
      platform: 'darwin',
      arch: 'arm64',
      libc: null,
      target: 'aarch64-apple-darwin'
    })
    expect(normalizePath(selection.binaryPath)).toBe('/tmp/ripgrep/aarch64-apple-darwin/rg')
  })
})

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}
