import type { MCPServerConfig } from '../types.js'
import type { MCPTransport } from './types.js'
import { HTTPMCPTransport } from './httpTransport.js'
import { StdioMCPTransport } from './stdioTransport.js'

export function createTransport(server: MCPServerConfig): MCPTransport {
  if (server.transport === 'stdio') {
    return new StdioMCPTransport()
  }
  return new HTTPMCPTransport()
}
