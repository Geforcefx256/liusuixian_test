import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import path from 'node:path'

export type RipgrepLibc = 'glibc' | 'musl'
type RipgrepPlatform = 'linux' | 'win32' | 'darwin'
type RipgrepArch = 'x64' | 'arm64'

export interface RipgrepRuntimeInfo {
  platform: NodeJS.Platform
  arch: NodeJS.Architecture
  libc: RipgrepLibc | null
}

export interface RipgrepSelection {
  platform: RipgrepPlatform
  arch: RipgrepArch
  libc: RipgrepLibc | null
  target: string
  binaryPath: string
}

const WINDOWS_BINARY = 'rg.exe'
const POSIX_BINARY = 'rg'

export function detectRipgrepRuntimeInfo(): RipgrepRuntimeInfo {
  return {
    platform: process.platform,
    arch: process.arch,
    libc: process.platform === 'linux' ? detectLinuxLibc() : null
  }
}

export function resolveRipgrepSelection(
  ripgrepRoot: string,
  runtime: RipgrepRuntimeInfo
): RipgrepSelection {
  const platform = normalizePlatform(runtime.platform)
  const arch = normalizeArch(runtime.arch)
  const target = resolveTarget(platform, arch, runtime.libc)
  return {
    platform,
    arch,
    libc: platform === 'linux' ? runtime.libc : null,
    target,
    binaryPath: path.join(ripgrepRoot, target, binaryNameForPlatform(platform))
  }
}

export async function assertRipgrepBinaryAccessible(selection: RipgrepSelection): Promise<void> {
  const mode = selection.platform === 'win32' ? constants.F_OK : constants.X_OK
  try {
    await access(selection.binaryPath, mode)
  } catch {
    throw new Error(`Vendored ripgrep binary is unavailable for target ${selection.target}: ${selection.binaryPath}`)
  }
}

function detectLinuxLibc(): RipgrepLibc {
  const report = process.report?.getReport?.()
  const header = report && typeof report === 'object' && 'header' in report
    ? report.header
    : null
  const version = header && typeof header === 'object' && 'glibcVersionRuntime' in header
    ? header.glibcVersionRuntime
    : null
  return typeof version === 'string' && version.trim() ? 'glibc' : 'musl'
}

function normalizePlatform(platform: NodeJS.Platform): RipgrepPlatform {
  if (platform === 'linux' || platform === 'win32' || platform === 'darwin') {
    return platform
  }
  throw new Error(`Unsupported platform for vendored ripgrep: ${platform}`)
}

function normalizeArch(arch: NodeJS.Architecture): RipgrepArch {
  if (arch === 'x64' || arch === 'arm64') {
    return arch
  }
  throw new Error(`Unsupported architecture for vendored ripgrep: ${arch}`)
}

function resolveTarget(platform: RipgrepPlatform, arch: RipgrepArch, libc: RipgrepLibc | null): string {
  if (platform === 'linux') {
    return resolveLinuxTarget(arch, libc)
  }
  if (platform === 'darwin') {
    return resolveDarwinTarget(arch)
  }
  return resolveWindowsTarget(arch)
}

function binaryNameForPlatform(platform: RipgrepPlatform): string {
  return platform === 'win32' ? WINDOWS_BINARY : POSIX_BINARY
}

function resolveLinuxTarget(arch: RipgrepArch, libc: RipgrepLibc | null): string {
  if (!libc) {
    throw new Error('Linux vendored ripgrep target requires libc classification.')
  }
  if (arch === 'x64') {
    return libc === 'glibc'
      ? 'x86_64-unknown-linux-gnu'
      : 'x86_64-unknown-linux-musl'
  }
  return libc === 'glibc'
    ? 'aarch64-unknown-linux-gnu'
    : 'aarch64-unknown-linux-musl'
}

function resolveDarwinTarget(arch: RipgrepArch): string {
  return arch === 'x64'
    ? 'x86_64-apple-darwin'
    : 'aarch64-apple-darwin'
}

function resolveWindowsTarget(arch: RipgrepArch): string {
  return arch === 'x64'
    ? 'x86_64-pc-windows-msvc'
    : 'aarch64-pc-windows-msvc'
}
