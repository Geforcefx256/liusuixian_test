import { describe, expect, it } from 'vitest'
import { parseSkillFrontmatter } from './frontmatter.js'

describe('parseSkillFrontmatter', () => {
  it('parses quoted values, colons, and block scalars with YAML semantics', () => {
    const result = parseSkillFrontmatter([
      '---',
      'id: dpi-planner',
      'name: "dpi: planner"',
      'description: |-',
      '  第一行: 保留冒号',
      '  第二行继续',
      'when-to-use: "当用户需要: 规划入口"',
      'input-example: "foo: bar"',
      'output-example: "result: ok"',
      'allowed-tools:',
      '  - local:question',
      '  - skill:skill',
      'user-invocable: true',
      'disable-model-invocation: false',
      'model: gpt-5-mini',
      'effort: medium',
      'context: inline',
      '---',
      '',
      '# Body'
    ].join('\n'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.metadata).toEqual({
      id: 'dpi-planner',
      name: 'dpi: planner',
      description: '第一行: 保留冒号\n第二行继续',
      whenToUse: '当用户需要: 规划入口',
      inputExample: 'foo: bar',
      outputExample: 'result: ok',
      userInvocable: true,
      disableModelInvocation: false,
      model: 'gpt-5-mini',
      effort: 'medium',
      context: 'inline',
      allowedTools: ['local:question', 'skill:skill']
    })
  })

  it('rejects legacy multi-word field aliases and governed metadata fields', () => {
    const result = parseSkillFrontmatter([
      '---',
      'id: dpi-planner',
      'name: dpi-planner',
      'description: planner',
      'inputExample: bad',
      'when_to_use: bad',
      'displayName: governed',
      'starter-summary: governed',
      'agentBindings:',
      '  - workspace-agent',
      '---'
    ].join('\n'))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'inputExample' }),
      expect.objectContaining({ field: 'when_to_use' }),
      expect.objectContaining({ field: 'displayName' }),
      expect.objectContaining({ field: 'starter-summary' }),
      expect.objectContaining({ field: 'agentBindings' })
    ]))
  })

  it('accepts omitted optional metadata fields without synthesizing defaults', () => {
    const result = parseSkillFrontmatter([
      '---',
      'id: minimal-skill',
      'name: Minimal Skill',
      'description: Minimal description.',
      '---'
    ].join('\n'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.metadata).toEqual({
      id: 'minimal-skill',
      name: 'Minimal Skill',
      description: 'Minimal description.'
    })
  })

  it('fails visibly for invalid yaml frontmatter', () => {
    const result = parseSkillFrontmatter([
      '---',
      'name: [broken',
      'description: bad yaml',
      '---'
    ].join('\n'))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.code).toBe('invalid_yaml')
  })
})
