import { describe, expect, it } from 'vitest'
import { buildSkillListingReminder } from './skillListing.js'
import type { AgentSkill } from './types.js'

const BASE_SKILL: AgentSkill = {
  id: 'demo-skill',
  name: 'demo-skill',
  description: 'Summarize governed metadata without leaking full skill content.',
  whenToUse: 'Use when the request clearly matches the governed skill workflow.',
  instructions: 'This field must not appear in the listing reminder.',
  sourcePath: '/tmp/demo-skill/SKILL.md'
}

describe('buildSkillListingReminder', () => {
  it('renders only canonical summary fields for executor listing reminders', () => {
    const result = buildSkillListingReminder({
      skills: [BASE_SKILL]
    })

    expect(result.discoveryMode).toBe('disabled')
    expect(result.reminder).toContain('- name: demo-skill')
    expect(result.reminder).toContain('description: Summarize governed metadata')
    expect(result.reminder).toContain('whenToUse: Use when the request clearly matches')
    expect(result.reminder).not.toContain('discoveryMode: disabled')
    expect(result.reminder).not.toContain('sourcePath')
    expect(result.reminder).not.toContain('/tmp/demo-skill/SKILL.md')
    expect(result.reminder).not.toContain('instructions')
  })

  it('trims oversized entries predictably and skips trailing entries when total budget is exhausted', () => {
    const result = buildSkillListingReminder({
      skills: [
        {
          ...BASE_SKILL,
          description: 'Description '.repeat(20),
          whenToUse: 'When to use '.repeat(20)
        },
        {
          ...BASE_SKILL,
          id: 'skipped-skill',
          name: 'skipped-skill'
        }
      ],
      entryBudgetChars: 140,
      totalBudgetChars: 420
    })

    expect(result.reminder).toContain('- name: demo-skill')
    expect(result.reminder).toContain('[trimmed]')
    expect(result.reminder).not.toContain('skipped-skill')
    expect(result.trimmedSkillCount).toBe(2)
    expect(result.skippedSkillCount).toBe(1)
    expect(result.entries).toEqual([
      expect.objectContaining({
        skillId: 'demo-skill',
        status: 'included',
        trimMode: expect.stringMatching(/description|whenToUse/)
      }),
      expect.objectContaining({
        skillId: 'skipped-skill',
        status: 'skipped',
        skippedReason: 'total_budget'
      })
    ])
  })
})
