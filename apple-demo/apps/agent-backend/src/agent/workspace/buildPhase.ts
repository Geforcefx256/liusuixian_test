import type { AgentDefinition, AgentRunRequest, AgentSkill } from '../types.js'
import type { AgentExecutionCatalog } from '../../agents/service.js'
import type { WorkspacePlanRecord } from './types.js'

export function buildExecutionRequest(params: {
  request: AgentRunRequest
  executionCatalog: AgentExecutionCatalog
  approvedPlan: WorkspacePlanRecord
}): AgentRunRequest {
  const approvedSkills = filterApprovedSkills(
    resolveAvailableSkills(params.request, params.executionCatalog),
    params.approvedPlan.approvedSkillIds
  )
  return {
    ...params.request,
    executionPhase: 'executor',
    agentDefinition: buildExecutionAgentDefinition(
      params.executionCatalog.agent,
      params.approvedPlan
    ),
    availableSkills: approvedSkills,
    allowedSkillIds: [...params.approvedPlan.approvedSkillIds]
  }
}

export function buildDefaultExecutionRequest(params: {
  request: AgentRunRequest
  executionCatalog: AgentExecutionCatalog
}): AgentRunRequest {
  return {
    ...params.request,
    executionPhase: 'executor',
    agentDefinition: params.executionCatalog.agent,
    availableSkills: resolveAvailableSkills(params.request, params.executionCatalog),
    allowedSkillIds: undefined
  }
}

function resolveAvailableSkills(
  request: AgentRunRequest,
  executionCatalog: AgentExecutionCatalog
): AgentSkill[] {
  if (Array.isArray(request.availableSkills) && request.availableSkills.length > 0) {
    return request.availableSkills
  }
  return executionCatalog.skills
}

function filterApprovedSkills(skills: AgentSkill[], approvedSkillIds: string[]): AgentSkill[] {
  const allowed = new Set(approvedSkillIds)
  return skills.filter(skill => allowed.has(skill.id))
}

function buildExecutionAgentDefinition(
  definition: AgentDefinition,
  plan: WorkspacePlanRecord
): AgentDefinition {
  const sections = [
    definition.instructions.trim(),
    '## Approved Plan',
    `Plan ID: ${plan.planId}`,
    `Plan Version: ${plan.version}`,
    `Plan File: ${plan.filePath}`,
    `Summary: ${plan.summary}`,
    `Goal: ${plan.goal}`,
    'Steps:',
    ...plan.steps.map((step, index) => `${index + 1}. ${step}`),
    `Approved Skills: ${plan.approvedSkillIds.join(', ') || '(none)'}`,
    'Rules:',
    '- 只允许在 Approved Skills 中选择 skill。',
    '- 如果缺少路径、文件名、sheet 名、列号、开始行、版本、具体值等执行细节参数，优先在 build 阶段继续提问补齐。',
    '- 只有当缺失信息会改变任务范围、技能选择或验收标准时，才停止执行并明确要求回到 plan。',
    '- 不要假装已经完成未执行的步骤。'
  ]
  return {
    ...definition,
    instructions: sections.filter(Boolean).join('\n')
  }
}
