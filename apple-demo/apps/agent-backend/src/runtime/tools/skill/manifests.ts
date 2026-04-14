import type { GatewayToolManifest } from '../../../gateway/tools/types.js'
import type { SkillCatalogEntry } from '../../../skills/catalog.js'
import { buildSkillExecToolDescription, buildSkillToolDescription } from './content.js'
import { findAssetsInputSchema, listAssetsInputSchema, readAssetInputSchema } from './assets.js'

const execToolInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    skillName: {
      type: 'string',
      description: 'Approved skill name or id that owns the target script template.'
    },
    templateId: {
      type: 'string',
      description: 'Template id declared in the skill package SCRIPTS.yaml manifest.'
    },
    args: {
      type: 'object',
      additionalProperties: true,
      description: 'Structured arguments for the selected script template.'
    }
  },
  required: ['skillName', 'templateId', 'args']
}

export function buildSkillToolCatalog(skills: SkillCatalogEntry[]): GatewayToolManifest[] {
  const manifests: GatewayToolManifest[] = [
    {
      id: 'skill',
      server: 'skill',
      name: 'skill',
      description: buildSkillToolDescription(skills),
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Skill name or id to load from SKILL.md'
          }
        },
        required: ['name']
      }
    },
    {
      id: 'read_asset',
      server: 'skill',
      name: 'read_asset',
      description: 'Read a text file from an approved skill package by exact skill-relative path. Use this for read-only skill-owned assets after you already know the path. This is not for workspace files and does not allow reading the canonical SKILL.md.',
      inputSchema: readAssetInputSchema
    },
    {
      id: 'list_assets',
      server: 'skill',
      name: 'list_assets',
      description: 'List directory entries from an approved skill package by exact skill-relative path. Use this to inspect a known directory inside one skill package. This is not for workspace files.',
      inputSchema: listAssetsInputSchema
    },
    {
      id: 'find_assets',
      server: 'skill',
      name: 'find_assets',
      description: 'Find files by filename or glob pattern inside one approved skill package when you do not know the exact asset path yet. Returns paths relative to that skill package, not workspace paths.',
      inputSchema: findAssetsInputSchema
    }
  ]
  if (skills.some(skill => skill.execTemplates.length > 0)) {
    manifests.push({
      id: 'exec',
      server: 'skill',
      name: 'exec',
      description: buildSkillExecToolDescription(skills.filter(skill => skill.execTemplates.length > 0)),
      inputSchema: execToolInputSchema
    })
  }
  return manifests
}
