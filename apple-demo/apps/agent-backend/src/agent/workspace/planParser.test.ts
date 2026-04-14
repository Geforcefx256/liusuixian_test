import { describe, expect, it } from 'vitest'
import { parseWorkspacePlanDraft } from './planParser.js'
import type { AgentSkill } from '../types.js'

const SKILLS: AgentSkill[] = [{
  id: 'sheet-analyzer',
  name: 'Sheet Analyzer',
  description: 'Analyze worksheet data',
  instructions: 'Analyze data'
}]

describe('parseWorkspacePlanDraft', () => {
  it('parses a low-information clarification plan', () => {
    const draft = parseWorkspacePlanDraft(JSON.stringify({
      title: '澄清需求',
      summary: '当前信息不足，需要先明确任务目标。',
      goal: '确认用户想完成的任务、输入数据和期望结果。',
      steps: [
        '询问用户希望完成的具体任务。',
        '等待用户补充任务、输入和期望结果后，再生成可执行计划。'
      ],
      approvedSkillIds: [],
      skillsReasoning: [],
      risks: ['当前无法直接进入执行阶段。'],
      openQuestions: ['你希望我帮你做什么？请补充任务、输入和期望结果。']
    }), SKILLS)

    expect(draft.title).toBe('澄清需求')
    expect(draft.openQuestions).toContain('你希望我帮你做什么？请补充任务、输入和期望结果。')
    expect(draft.steps).toHaveLength(2)
  })

  it('surfaces invalid JSON with planner context', () => {
    expect(() => parseWorkspacePlanDraft('{title:"bad"}', SKILLS))
      .toThrow(/规划器返回了非法 JSON/)
  })

  it('rejects empty steps as an invalid plan', () => {
    expect(() => parseWorkspacePlanDraft(JSON.stringify({
      title: '澄清需求',
      summary: '当前信息不足，需要先明确任务目标。',
      goal: '确认用户想完成的任务、输入数据和期望结果。',
      steps: [],
      approvedSkillIds: [],
      skillsReasoning: [],
      risks: ['当前无法直接进入执行阶段。'],
      openQuestions: ['你希望我帮你做什么？请补充任务、输入和期望结果。']
    }), SKILLS)).toThrow('规划器返回了无效计划：steps 数量必须在 1-8。')
  })

  it('rejects too many steps', () => {
    expect(() => parseWorkspacePlanDraft(JSON.stringify({
      title: '计划',
      summary: '摘要',
      goal: '目标',
      steps: Array.from({ length: 9 }, (_, index) => `步骤${index + 1}`),
      approvedSkillIds: [],
      skillsReasoning: [],
      risks: [],
      openQuestions: []
    }), SKILLS)).toThrow('规划器返回了无效计划：steps 数量必须在 1-8。')
  })

  it('rejects executed wording in plan text', () => {
    expect(() => parseWorkspacePlanDraft(JSON.stringify({
      title: '计划已完成',
      summary: '已经完成实现。',
      goal: '目标',
      steps: ['整理需求'],
      approvedSkillIds: [],
      skillsReasoning: [],
      risks: [],
      openQuestions: []
    }), SKILLS)).toThrow('规划器返回了无效计划：计划文本不能包含已执行/已完成表述。')
  })

  it('rejects invalid openQuestions shape', () => {
    expect(() => parseWorkspacePlanDraft(JSON.stringify({
      title: '澄清需求',
      summary: '当前信息不足，需要先明确任务目标。',
      goal: '确认用户想完成的任务、输入数据和期望结果。',
      steps: ['先收集信息'],
      approvedSkillIds: [],
      skillsReasoning: [],
      risks: ['当前无法直接进入执行阶段。'],
      openQuestions: [1]
    }), SKILLS)).toThrow('规划器返回了无效计划：openQuestions 必须是字符串数组。')
  })

  it('allows parameter-style open questions', () => {
    const draft = parseWorkspacePlanDraft(JSON.stringify({
      title: '导入 CSV',
      summary: '先规划导入流程。',
      goal: '完成导入方案设计。',
      steps: ['执行阶段确认目标 sheet 名称并写入。'],
      approvedSkillIds: [],
      skillsReasoning: [],
      risks: ['CSV 文件可能为空或格式不符合预期。'],
      openQuestions: ['需要确认 sheet 名称。']
    }), SKILLS)

    expect(draft.openQuestions).toEqual(['需要确认 sheet 名称。'])
  })

  it('allows parameter-style risks', () => {
    const draft = parseWorkspacePlanDraft(JSON.stringify({
      title: '导入 CSV',
      summary: '先规划导入流程。',
      goal: '完成导入方案设计。',
      steps: ['执行阶段确认目标 sheet 名称并写入。'],
      approvedSkillIds: [],
      skillsReasoning: [],
      risks: ['需要确认开始行。'],
      openQuestions: []
    }), SKILLS)

    expect(draft.risks).toEqual(['需要确认开始行。'])
  })

  it('allows parameter handoff in steps', () => {
    const draft = parseWorkspacePlanDraft(JSON.stringify({
      title: '导入 CSV',
      summary: '先规划导入流程。',
      goal: '完成导入方案设计。',
      steps: ['执行阶段确认目标 sheet 名称并写入。'],
      approvedSkillIds: [],
      skillsReasoning: [],
      risks: ['CSV 文件可能为空或格式不符合预期。'],
      openQuestions: ['需要确认是写入现有表还是创建新表。']
    }), SKILLS)

    expect(draft.steps).toEqual(['执行阶段确认目标 sheet 名称并写入。'])
  })
})
