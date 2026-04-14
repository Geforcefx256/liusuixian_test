import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileStore, type WorkspaceScope } from '../../../files/fileStore.js'
import { resolveBackendRoot } from '../../../support/runtimePaths.js'
import type { ScriptTemplate } from '../../../skills/scriptManifestTypes.js'
import { parseSkillExecutionOutput } from '../../../agent/skillResult.js'
import { validateAndResolveScriptArgs, type ScriptExecutionRoots } from './execValidation.js'

const OUTPUT_MAX_BYTES = 50 * 1024
const OUTPUT_MAX_LINES = 2000

export interface ExecuteScriptParams {
  template: ScriptTemplate
  args: Record<string, unknown>
  workspaceScope: WorkspaceScope
  runtimeRoot: string
  signal?: AbortSignal
}

export async function executeGovernedScript(params: ExecuteScriptParams): Promise<string> {
  await fileStore.initialize()
  const roots = getExecutionRoots(params.workspaceScope, params.runtimeRoot)
  await ensureExecutionRoots(roots)
  const resolvedArgs = validateAndResolveScriptArgs(params.template.inputSchema, params.args, roots)
  const argv = await buildNodeArgv(params.template, resolvedArgs)
  const execution = await runNodeProcess(argv, roots, params.template.timeoutSeconds, params.signal)
  const stdout = trimOutput(execution.stdout)
  const stderr = trimOutput(execution.stderr)

  if (execution.timedOut) {
    throw new Error(`skill script timed out after ${params.template.timeoutSeconds} seconds`)
  }
  if (execution.aborted) {
    throw new Error('skill script aborted')
  }
  if (execution.exitCode !== 0) {
    throw new Error(stderr || stdout || `skill script exited with code ${execution.exitCode}`)
  }
  return registerArtifactIfNeeded(stdout, params.workspaceScope, roots)
}

async function buildNodeArgv(template: ScriptTemplate, resolvedArgs: Record<string, unknown>): Promise<string[]> {
  const nodeArgs: string[] = []
  if (template.entryPath.endsWith('.ts')) {
    nodeArgs.push('--import', resolveTsxLoaderPath())
  }
  nodeArgs.push(template.entryPath)
  for (const item of template.argv) {
    if (item.kind === 'payload') {
      const payload = JSON.stringify(resolvedArgs)
      nodeArgs.push(item.encoding === 'base64-json' ? Buffer.from(payload).toString('base64') : payload)
      continue
    }
    const value = resolvedArgs[item.name]
    if (item.kind === 'flag') {
      if (value === true) {
        nodeArgs.push(item.flag)
      }
      continue
    }
    if (value === undefined) {
      continue
    }
    nodeArgs.push(item.flag, String(value))
  }
  return nodeArgs
}

function resolveTsxLoaderPath(): string {
  const backendRoot = resolveBackendRoot(import.meta.url, 3)
  const loaderPath = `${backendRoot}/node_modules/tsx/dist/loader.mjs`
  if (!existsSync(loaderPath)) {
    throw new Error(`TSX loader not found: ${loaderPath}`)
  }
  return loaderPath
}

function runNodeProcess(
  argv: string[],
  roots: ScriptExecutionRoots,
  timeoutSeconds: number,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean; aborted: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', argv, {
      cwd: roots.workspaceRoot,
      env: {
        ...process.env,
        RUNTIME_ROOT: roots.runtimeRoot,
        WORKSPACE_ROOT: roots.workspaceRoot,
        WORKSPACE_UPLOAD_DIR: roots.uploadDir,
        WORKSPACE_PROJECT_DIR: roots.projectDir,
        WORKSPACE_TEMP_DIR: roots.tempDir
      },
      shell: false,
      detached: true
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let aborted = false
    let settled = false

    function terminateChild(): void {
      if (!child.pid) {
        return
      }
      try {
        if (process.platform === 'win32') {
          execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
        } else {
          process.kill(-child.pid, 'SIGKILL')
        }
      } catch {
        try {
          child.kill('SIGKILL')
        } catch {}
      }
    }

    function finalize(result: { stdout: string; stderr: string; exitCode: number; timedOut: boolean; aborted: boolean }) {
      if (settled) {
        return
      }
      settled = true
      resolve(result)
    }

    const timeout = setTimeout(() => {
      timedOut = true
      terminateChild()
    }, timeoutSeconds * 1000)

    signal?.addEventListener('abort', () => {
      aborted = true
      terminateChild()
    }, { once: true })

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
    child.on('error', error => {
      clearTimeout(timeout)
      settled = true
      reject(error)
    })
    child.on('close', exitCode => {
      clearTimeout(timeout)
      finalize({
        stdout,
        stderr,
        exitCode: exitCode ?? 0,
        timedOut,
        aborted
      })
    })
  })
}

async function registerArtifactIfNeeded(
  stdout: string,
  workspaceScope: WorkspaceScope,
  roots: ScriptExecutionRoots
): Promise<string> {
  const parsed = tryParseDomainResult(stdout)
  if (!parsed || parsed.kind !== 'artifact_ref') {
    return stdout
  }
  const rawPath = typeof parsed.data.path === 'string' ? parsed.data.path : ''
  const projectRelativePath = toProjectRelativePath(rawPath, roots.projectDir)
  const registration = await fileStore.registerProjectPath(projectRelativePath, workspaceScope)
  return JSON.stringify({
    kind: 'artifact_ref',
    data: {
      fileId: registration.entry.fileId,
      fileKey: registration.entry.fileKey,
      fileName: registration.entry.originalName,
      path: fileStore.getWorkspaceRelativePath(registration.entry),
      created: registration.created
    }
  }, null, 2)
}

function tryParseDomainResult(stdout: string) {
  try {
    return parseSkillExecutionOutput(stdout, { label: 'tool skill:exec' })
  } catch {
    return null
  }
}

function toProjectRelativePath(rawPath: string, projectDir: string): string {
  const normalized = rawPath.trim()
  if (normalized.startsWith('project/')) {
    return normalized.slice('project/'.length)
  }
  const absolutePath = path.resolve(normalized)
  const relative = path.relative(projectDir, absolutePath)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('artifact_ref path must stay under project/')
  }
  return relative.replace(/\\/g, '/')
}

function trimOutput(output: string): string {
  const lines = output.split('\n')
  const limitedLines = lines.length > OUTPUT_MAX_LINES ? lines.slice(0, OUTPUT_MAX_LINES) : lines
  const joined = limitedLines.join('\n')
  return Buffer.byteLength(joined, 'utf8') <= OUTPUT_MAX_BYTES
    ? joined.trim()
    : Buffer.from(joined, 'utf8').subarray(0, OUTPUT_MAX_BYTES).toString('utf8').trim()
}

function getExecutionRoots(scope: WorkspaceScope, runtimeRoot: string): ScriptExecutionRoots {
  return {
    workspaceRoot: fileStore.getWorkspaceRoot(scope),
    uploadDir: fileStore.getUploadDir(scope),
    projectDir: fileStore.getProjectDir(scope),
    tempDir: fileStore.getTempDir(scope),
    runtimeRoot
  }
}

async function ensureExecutionRoots(roots: ScriptExecutionRoots): Promise<void> {
  await Promise.all([
    mkdir(roots.workspaceRoot, { recursive: true }),
    mkdir(roots.uploadDir, { recursive: true }),
    mkdir(roots.projectDir, { recursive: true }),
    mkdir(roots.tempDir, { recursive: true })
  ])
}
