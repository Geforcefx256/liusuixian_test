import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { WorkspacePlanDraft } from './types.js'

export async function writePlanDocument(params: {
  workspaceDir: string
  sessionId: string
  version: number
  draft: WorkspacePlanDraft
}): Promise<{ filePath: string; markdown: string }> {
  const slug = slugify(params.draft.title || 'plan')
  const relativePath = `plans/agent/${params.sessionId}/v${params.version}-${slug}.md`
  const absolutePath = resolve(params.workspaceDir, relativePath)
  const markdown = renderPlanMarkdown(params.draft)
  await mkdir(resolve(params.workspaceDir, 'plans', 'agent', params.sessionId), { recursive: true })
  await writeFile(absolutePath, markdown, 'utf-8')
  return { filePath: relativePath, markdown }
}

export function renderPlanMarkdown(draft: WorkspacePlanDraft): string {
  const lines: string[] = []
  lines.push(`# ${draft.title}`)
  lines.push('')
  lines.push('## Summary')
  lines.push(draft.summary)
  lines.push('')
  lines.push('## Goal')
  lines.push(draft.goal)
  pushSection(lines, 'Steps', draft.steps)
  pushSection(lines, 'Approved Skills', draft.approvedSkillIds)
  pushSection(lines, 'Skill Reasoning', draft.skillsReasoning)
  pushSection(lines, 'Risks', draft.risks)
  pushSection(lines, 'Open Questions', draft.openQuestions)
  return `${lines.join('\n').trim()}\n`
}

function pushSection(lines: string[], title: string, items: string[]): void {
  lines.push('')
  lines.push(`## ${title}`)
  if (items.length === 0) {
    lines.push('- (none)')
    return
  }
  for (const item of items) {
    lines.push(`- ${item}`)
  }
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'plan'
}
