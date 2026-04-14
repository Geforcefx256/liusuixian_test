import type { MCPExecuteRequest, MCPServerConfig } from '../types.js'

export interface MCPTransport {
  execute(server: MCPServerConfig, tool: string, request: MCPExecuteRequest): Promise<unknown>
}
