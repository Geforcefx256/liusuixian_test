import { describe, expect, it } from 'vitest'
import type { AgentSessionMessage } from '../sessionStoreTypes.js'
import { createSkillContextMessage } from '../sessionMessages.js'
import { extractRetainedSkills } from './retainedSkillState.js'

function createMessage(parts: AgentSessionMessage['parts'], createdAt: number): AgentSessionMessage {
  return {
    role: 'assistant',
    createdAt,
    parts
  }
}

describe('extractRetainedSkills', () => {
  it('keeps only the latest successful content per canonical skill name', () => {
    const extraction = extractRetainedSkills([
      createSkillContextMessage({
        skillName: 'skill-a',
        text: '<skill_content name="skill-a">\nold-a\n</skill_content>',
        createdAt: 1
      }),
      createSkillContextMessage({
        skillName: 'skill-b',
        text: '<skill_content name="skill-b">\nbody-b\n</skill_content>',
        createdAt: 2
      }),
      createSkillContextMessage({
        skillName: 'skill-a',
        text: '<skill_content name="skill-a">\nnew-a\n</skill_content>',
        createdAt: 3
      })
    ])

    expect(extraction.skills).toEqual([
      {
        skillName: 'skill-a',
        content: '<skill_content name="skill-a">\nnew-a\n</skill_content>',
        createdAt: 3
      },
      {
        skillName: 'skill-b',
        content: '<skill_content name="skill-b">\nbody-b\n</skill_content>',
        createdAt: 2
      }
    ])
  })

  it('ignores ordinary messages that do not persist hidden skill context', () => {
    const extraction = extractRetainedSkills([
      {
        role: 'assistant',
        createdAt: 1,
        parts: [{
          type: 'text',
          text: '可用技能：skill-a、skill-b'
        }]
      },
      createMessage([{
        type: 'tool',
        id: 'tool-skill-b',
        name: 'skill:skill',
        input: { name: 'skill-b' },
        status: 'success',
        output: 'Loaded skill "skill-b".'
      }], 2),
      createSkillContextMessage({
        skillName: 'skill-b',
        text: '<skill_content name="skill-b">\nbody-b\n</skill_content>',
        createdAt: 3
      })
    ])

    expect(extraction.skills).toEqual([{
      skillName: 'skill-b',
      content: '<skill_content name="skill-b">\nbody-b\n</skill_content>',
      createdAt: 3
    }])
    expect(extraction.scannedSkillContextMessages).toBe(1)
    expect(extraction.skippedInvalidSkillContextMessages).toBe(0)
  })

  it('skips invalid hidden skill-context messages without text', () => {
    const extraction = extractRetainedSkills([
      {
        role: 'assistant',
        createdAt: 1,
        parts: [],
        attributes: {
          visibility: 'hidden',
          semantic: 'skill-context',
          skillName: 'skill-a'
        }
      }
    ])

    expect(extraction.skills).toEqual([])
    expect(extraction.scannedSkillContextMessages).toBe(1)
    expect(extraction.skippedInvalidSkillContextMessages).toBe(1)
  })
})
