import type { WorkspacePlanRecord } from './types.js'

export function buildPlanProtocol(plan: WorkspacePlanRecord): Record<string, unknown> {
  const components: Array<Record<string, unknown>> = [
    {
      type: 'text',
      id: 'plan-title',
      content: `计划 v${plan.version}: ${plan.title}`,
      style: 'heading'
    },
    {
      type: 'text',
      id: 'plan-summary',
      content: plan.summary
    },
    {
      type: 'list',
      id: 'plan-steps',
      label: '执行步骤',
      items: plan.steps.map((step, index) => ({
        id: `step-${index + 1}`,
        title: `步骤 ${index + 1}`,
        description: step
      }))
    },
    {
      type: 'list',
      id: 'plan-skills',
      label: '批准后可用技能',
      items: plan.approvedSkillIds.map(skillId => ({
        id: skillId,
        title: skillId
      }))
    }
  ]

  if (plan.risks.length > 0) {
    components.push({
      type: 'list',
      id: 'plan-risks',
      label: '风险项',
      items: plan.risks.map((entry, index) => ({
        id: `risk-${index + 1}`,
        title: entry
      }))
    })
  }

  if (plan.openQuestions.length > 0) {
    components.push({
      type: 'list',
      id: 'plan-open-questions',
      label: '待确认项',
      items: plan.openQuestions.map((entry, index) => ({
        id: `question-${index + 1}`,
        title: entry
      }))
    })
  }

  return {
    version: '1.0',
    components,
    actions: [
      {
        id: 'plan-approve',
        label: '批准执行',
        type: 'tool',
        tool: 'plan_decision',
        toolInput: {
          decision: 'approve',
          planId: plan.planId
        }
      },
      {
        id: 'plan-revise',
        label: '继续修改',
        type: 'tool',
        tool: 'plan_decision',
        toolInput: {
          decision: 'revise',
          planId: plan.planId
        }
      }
    ],
    meta: {
      taskId: plan.planId
    }
  }
}
