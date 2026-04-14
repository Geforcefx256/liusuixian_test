import type { AgentSkill } from '../types.js'
import type { WorkspacePlanDraft } from './types.js'

const MIN_PLAN_STEPS = 1
const MAX_PLAN_STEPS = 8
const EXECUTED_WORDINGS = ['已完成', '已经完成', '已执行', '已修改', '已生成', '已实现', 'done', 'completed']

export function parseWorkspacePlanDraft(text: string, skills: AgentSkill[]): WorkspacePlanDraft {
  const parsed = extractJson(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('规划器返回了无效计划：根对象必须是 JSON object。')
  }
  const candidate = parsed as Partial<WorkspacePlanDraft>
  assertValidStringField(candidate.title, 'title')
  assertValidStringField(candidate.summary, 'summary')
  assertValidStringField(candidate.goal, 'goal')
  const approvedSkillIds = filterApprovedSkillIds(candidate.approvedSkillIds, skills)
  const steps = ensureNonEmptyStrings(candidate.steps)
  assertStepCount(steps)
  assertNoExecutedWordings(firstText(candidate.title, ''))
  assertNoExecutedWordings(firstText(candidate.summary, ''))
  assertNoExecutedWordings(firstText(candidate.goal, ''))
  for (const step of steps) assertNoExecutedWordings(step)
  const risks = ensureStringArrayField(candidate.risks, 'risks')
  const openQuestions = ensureStringArrayField(candidate.openQuestions, 'openQuestions')
  assertStringArrayField(candidate.skillsReasoning, 'skillsReasoning')
  return {
    title: firstText(candidate.title, '未命名计划'),
    summary: firstText(candidate.summary, '暂无摘要'),
    goal: firstText(candidate.goal, '未提供目标'),
    steps,
    approvedSkillIds,
    skillsReasoning: ensureNonEmptyStrings(candidate.skillsReasoning),
    risks,
    openQuestions
  }
}

function assertStepCount(steps: string[]): void {
  if (steps.length < MIN_PLAN_STEPS || steps.length > MAX_PLAN_STEPS) {
    throw new Error(`规划器返回了无效计划：steps 数量必须在 ${MIN_PLAN_STEPS}-${MAX_PLAN_STEPS}。`)
  }
}

function assertNoExecutedWordings(value: string): void {
  const lowered = value.toLowerCase()
  for (const marker of EXECUTED_WORDINGS) {
    if (!lowered.includes(marker)) continue
    throw new Error('规划器返回了无效计划：计划文本不能包含已执行/已完成表述。')
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
  const jsonSource = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed
  try {
    return JSON.parse(jsonSource) as unknown
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown JSON parse error'
    throw new Error(`规划器返回了非法 JSON：${detail}`)
  }
}

function filterApprovedSkillIds(value: unknown, skills: AgentSkill[]): string[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set(skills.map(skill => skill.id))
  return value.filter((item): item is string => typeof item === 'string' && allowed.has(item))
}

function ensureNonEmptyStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

function ensureStringArrayField(
  value: unknown,
  fieldName: 'risks' | 'openQuestions'
): string[] {
  assertStringArrayField(value, fieldName)
  return ensureNonEmptyStrings(value)
}

function firstText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function assertValidStringField(value: unknown, fieldName: 'title' | 'summary' | 'goal'): void {
  if (typeof value === 'string' && value.trim()) {
    return
  }
  throw new Error(`规划器返回了无效计划：${fieldName} 必须是非空字符串。`)
}

function assertStringArrayField(
  value: unknown,
  fieldName: 'risks' | 'openQuestions' | 'skillsReasoning'
): void {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    throw new Error(`规划器返回了无效计划：${fieldName} 必须是字符串数组。`)
  }
  if (value.every(item => typeof item === 'string')) {
    return
  }
  throw new Error(`规划器返回了无效计划：${fieldName} 必须是字符串数组。`)
}
