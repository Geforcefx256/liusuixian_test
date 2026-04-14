import { spawn } from 'node:child_process'
import type { MCPTransport } from './types.js'
import type { MCPExecuteRequest, MCPServerConfig } from '../types.js'

function tryParseJsonLine(line: string): unknown | null {
  const text = line.trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export class StdioMCPTransport implements MCPTransport {
  async execute(server: MCPServerConfig, tool: string, request: MCPExecuteRequest): Promise<unknown> {
    if (!server.command) {
      throw new Error(`stdio MCP server "${server.id}" missing command`)
    }

    const payload = {
      tool,
      input: request.input,
      arguments: request.arguments,
      context: request.context,
      sessionKey: request.sessionKey,
      agentId: request.agentId
    }

    return await new Promise<unknown>((resolve, reject) => {
      const proc = spawn(server.command as string, server.args || [], {
        cwd: server.cwd,
        env: {
          ...process.env,
          ...(server.env || {})
        },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      let settled = false

      const done = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }

      proc.stdout.on('data', chunk => {
        stdout += String(chunk)
      })

      proc.stderr.on('data', chunk => {
        stderr += String(chunk)
      })

      proc.on('error', error => {
        done(() => reject(error))
      })

      proc.on('close', code => {
        if (code !== 0) {
          done(() => reject(new Error(`MCP stdio process exited with code ${code}: ${stderr.trim()}`)))
          return
        }

        const lines = stdout
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)

        for (let i = lines.length - 1; i >= 0; i--) {
          const parsed = tryParseJsonLine(lines[i])
          if (parsed !== null) {
            done(() => resolve(parsed))
            return
          }
        }

        done(() => reject(new Error(`MCP stdio response is not valid JSON: ${stdout.slice(0, 500)}`)))
      })

      proc.stdin.write(`${JSON.stringify(payload)}\n`)
      proc.stdin.end()
    })
  }
}
