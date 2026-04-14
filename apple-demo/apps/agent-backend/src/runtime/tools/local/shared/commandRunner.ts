import { spawn } from 'node:child_process'

export interface CommandRunOptions {
  timeoutMs?: number
}

export interface CommandRunnerResult {
  stdout: string
  stderr: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
}

export interface CommandRunner {
  run(command: string, args: string[], cwd: string, options?: CommandRunOptions): Promise<CommandRunnerResult>
}

export class DefaultCommandRunner implements CommandRunner {
  run(command: string, args: string[], cwd: string, options: CommandRunOptions = {}): Promise<CommandRunnerResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      let timedOut = false
      const timer = options.timeoutMs
        ? setTimeout(() => {
            timedOut = true
            child.kill('SIGTERM')
          }, options.timeoutMs)
        : null

      child.stdout.on('data', chunk => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', chunk => {
        stderr += chunk.toString()
      })
      child.on('error', error => {
        if (timer) {
          clearTimeout(timer)
        }
        reject(error)
      })
      child.on('close', (code, signal) => {
        if (timer) {
          clearTimeout(timer)
        }
        resolve({
          stdout,
          stderr,
          exitCode: code,
          signal,
          timedOut
        })
      })
    })
  }
}
