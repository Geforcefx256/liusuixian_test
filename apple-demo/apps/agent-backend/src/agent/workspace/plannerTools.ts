import type { ToolRegistryLike } from '../loopTypes.js'
import type { GatewayInvokeResponse, GatewayToolManifest, GatewayToolsInvokeRequest } from '../../gateway/tools/types.js'

export const PLANNER_MAX_STEPS = 8

const PLANNER_ALLOWED_TOOL_IDS = new Set([
  'local:question',
  'local:read_file',
  'local:find_files',
  'skill:skill'
])

export function createPlannerToolRegistry(registry: ToolRegistryLike): ToolRegistryLike {
  return {
    catalog(request) {
      const response = registry.catalog(request)
      return {
        ...response,
        tools: response.tools.filter(tool => isPlannerAllowedTool(tool.id))
      }
    },
    invoke(request) {
      if (!isPlannerAllowedTool(request.tool)) {
        return Promise.resolve(buildToolDeniedResponse(request))
      }
      return registry.invoke(request)
    }
  }
}

function isPlannerAllowedTool(toolId: string): boolean {
  return PLANNER_ALLOWED_TOOL_IDS.has(toolId)
}

function buildToolDeniedResponse(request: GatewayToolsInvokeRequest): GatewayInvokeResponse {
  return {
    ok: false,
    requestId: crypto.randomUUID(),
    error: {
      type: 'TOOL_DENIED',
      message: `Planner cannot invoke tool "${request.tool}".`
    }
  }
}

export function filterPlannerTools(tools: GatewayToolManifest[]): GatewayToolManifest[] {
  return tools.filter(tool => isPlannerAllowedTool(tool.id))
}
