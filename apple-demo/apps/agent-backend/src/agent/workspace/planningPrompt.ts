import type { AgentDefinition, AgentRunRequest, AgentSkill } from '../types.js'
import type { AgentSessionMessage } from '../sessionStore.js'
import type { WorkspacePlanSnapshot } from './types.js'

const HISTORY_LIMIT = 8
const LOW_INFO_QUESTION = '你希望我帮你做什么？请补充任务、输入和期望结果。'

export function buildPlanningSystemPrompt(agent: AgentDefinition): string {
  const sections = [[
    '你是 workspace-agent 的 primary agent: plan。',
    '你的职责只有分析、规划、选择后续执行可能需要的 skills，并在必要时先澄清问题。',
    '你只能产出“可执行步骤计划”，不能产出执行结果，不能声称已完成任何实现。',
    '你可以使用的工具只有：local:question、skill:skill、local:read_file、local:find_files。',
    '禁止声称已经执行任务，禁止运行命令，禁止修改文件。',
    '当信息不足时，优先调用 local:question，先拿到用户补充后再继续规划。',
    '当你需要了解技能能力时，调用 skill:skill 读取对应 SKILL.md，但目的仅限生成步骤计划。',
    '当你需要读取项目内只读文件时，优先 local:find_files，再用 local:read_file，但目的仅限生成步骤计划。',
    'skill:read_asset、skill:find_assets、skill:list_assets 属于执行期工具，不在 planner 可用工具范围内。',
    '只有在信息已经足够、且不再需要调用工具时，最终输出才可以是计划 JSON。',
    '禁止返回自然语言解释，禁止输出 Markdown。',
    '最终 JSON 对象字段为：',
    '{"title":"", "summary":"", "goal":"", "steps":[""], "approvedSkillIds":[""], "skillsReasoning":[""], "risks":[""], "openQuestions":[""]}',
    '规则：',
    '1. approvedSkillIds 必须是候选 skills 中存在的 id。',
    '2. steps 必须是可执行步骤，长度 1-8。',
    '3. 如果信息不足且缺口会影响计划质量，先调用 local:question，不要硬编 openQuestions 代替提问。',
    '4. 当必须提问时，优先问目标、范围、优先级、验收标准等会影响规划质量的信息。',
    '5. summary、goal、steps、risks、openQuestions 使用中文。',
    '6. 不要输出 JSON 之外的任何字符。',
    '7. 即使用户只说“你好”“hi”“在吗”这类低信息输入，也不要输出问候语；应优先调用 local:question。',
    '8. JSON 必须是严格 JSON：对象键名使用双引号，字符串使用双引号，不能有尾逗号，不能有注释。',
    `9. 如果你在信息基本充分时仍保留 openQuestions，至少包含明确缺口，例如：${LOW_INFO_QUESTION}`
  ]]
  if (agent.instructions?.trim()) {
    sections.push([
      '## Agent Instructions',
      agent.instructions.trim()
    ])
  }
  if (agent.contextTemplate?.trim()) {
    sections.push([
      '## Context Template',
      agent.contextTemplate.trim()
    ])
  }
  return sections.map(section => section.join('\n')).join('\n\n')
}

export function buildPlanningUserInput(params: {
  request: AgentRunRequest
  history: AgentSessionMessage[]
  availableSkills: AgentSkill[]
  candidateSkills: AgentSkill[]
  latestPlan: WorkspacePlanSnapshot | null
}): string {
  const sections: string[] = []
  sections.push('## 当前请求')
  sections.push(params.request.input)
  sections.push('')
  sections.push('## 候选 Skills')
  sections.push(renderSkills(params.candidateSkills))
  sections.push('')
  sections.push('## 全量 Skills')
  sections.push(renderSkills(params.availableSkills))
  sections.push('')
  sections.push('## 近期会话')
  sections.push(renderHistory(params.history))
  sections.push('')
  sections.push('## 现有计划')
  sections.push(renderLatestPlan(params.latestPlan))
  sections.push('')
  sections.push('## 附加上下文')
  sections.push(renderInvocationContext(params.request))
  return sections.join('\n')
}

function renderSkills(skills: AgentSkill[]): string {
  if (skills.length === 0) return '- (none)'
  return skills.map(skill => (
    `- id: ${skill.id}\n  name: ${skill.name}\n  description: ${skill.description}`
  )).join('\n')
}

function renderHistory(history: AgentSessionMessage[]): string {
  const items = history
    .slice(-HISTORY_LIMIT)
    .map(message => {
      const text = message.parts
        .filter(part => part.type === 'text')
        .map(part => part.text.trim())
        .filter(Boolean)
        .join('\n')
      return `${message.role}: ${text || '[non-text]'}`
    })
  return items.length > 0 ? items.join('\n') : '- (empty)'
}

function renderLatestPlan(plan: WorkspacePlanSnapshot | null): string {
  if (!plan) return '- (none)'
  return [
    `- planId: ${plan.planId}`,
    `- version: ${plan.version}`,
    `- status: ${plan.status}`,
    `- title: ${plan.title}`,
    `- summary: ${plan.summary}`,
    `- approvedSkillIds: ${plan.approvedSkillIds.join(', ') || '(none)'}`
  ].join('\n')
}

function renderInvocationContext(request: AgentRunRequest): string {
  const parts: string[] = []
  const activeFile = request.invocationContext?.activeFile
  if (activeFile) {
    parts.push(`- activeFile: ${activeFile.path}`)
  }
  const selection = request.invocationContext?.selection
  if (selection) {
    parts.push(`- selectionColumns: ${selection.columns.join(', ')}`)
    parts.push(`- selectionRows: ${selection.rows.length}`)
  }
  const activeSheet = request.invocationContext?.activeSheet
  if (activeSheet?.sheetName) {
    parts.push(`- activeSheet: ${activeSheet.sheetName}`)
  }
  return parts.length > 0 ? parts.join('\n') : '- (none)'
}
