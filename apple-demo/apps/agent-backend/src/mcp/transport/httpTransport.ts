import type { MCPTransport } from './types.js'
import type { MCPExecuteRequest, MCPServerConfig } from '../types.js'

function toPayload(tool: string, request: MCPExecuteRequest): Record<string, unknown> {
  return {
    tool,
    input: request.input,
    arguments: request.arguments,
    context: request.context,
    sessionKey: request.sessionKey,
    agentId: request.agentId
  }
}

export class HTTPMCPTransport implements MCPTransport {
  async execute(server: MCPServerConfig, tool: string, request: MCPExecuteRequest): Promise<unknown> {
    if (!server.endpoint) {
      throw new Error(`HTTP MCP server "${server.id}" missing endpoint`)
    }

    const response = await fetch(server.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(server.headers || {})
      },
      body: JSON.stringify(toPayload(tool, request))
    })

    const body = await response.text()
    if (!response.ok) {
      throw new Error(`HTTP MCP request failed (${response.status}): ${body.slice(0, 500)}`)
    }

    if (!body.trim()) {
      return {}
    }

    const parsed = JSON.parse(body) as unknown
    if (typeof parsed === 'object' && parsed !== null && 'result' in parsed) {
      return (parsed as { result: unknown }).result
    }

    return parsed
  }
}
