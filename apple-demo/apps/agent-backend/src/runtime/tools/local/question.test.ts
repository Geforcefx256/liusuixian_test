import { describe, expect, it } from 'vitest'
import { buildQuestionProtocol } from './question.js'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 4
const RECOMMENDED_TAG = '(Recommended)'

function getFormComponent(protocol: Record<string, unknown>) {
  const components = (protocol.components || []) as Array<{ type?: string }>
  return components.find(comp => comp.type === 'form') as {
    id: string
    fields: Array<{
      id: string
      type: string
      value?: unknown
      required?: boolean
      options?: Array<{ label: string; value: unknown }>
    }>
  }
}

describe('buildQuestionProtocol', () => {
  it('accepts select options within bounds', () => {
    const protocol = buildQuestionProtocol({
      prompt: 'Pick one',
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' }
      ]
    })
    const form = getFormComponent(protocol)
    expect(form.fields).toMatchObject([
      {
        id: 'answer',
        type: 'select',
        value: ''
      },
      {
        id: 'notes',
        type: 'text',
        required: false
      }
    ])
    expect(form.fields[0].options?.length).toBe(MIN_OPTIONS)
  })

  it('rejects too few options and allows more than four options', () => {
    expect(() => buildQuestionProtocol({
      prompt: 'Pick one',
      options: [{ label: 'Only', value: 'only' }]
    })).toThrowError(/at least 2 items/)

    const protocol = buildQuestionProtocol({
      prompt: 'Pick one',
      options: Array.from({ length: MAX_OPTIONS + 1 }, (_, idx) => ({
        label: `Opt ${idx + 1}`,
        value: idx + 1
      }))
    })

    const form = getFormComponent(protocol)
    expect(form.fields[0].type).toBe('select')
    expect(form.fields[0].options?.length).toBe(MAX_OPTIONS + 1)
  })

  it('enforces recommended option ordering', () => {
    expect(() => buildQuestionProtocol({
      prompt: 'Pick one',
      options: [
        { label: 'First', value: '1' },
        { label: `Second ${RECOMMENDED_TAG}`, value: '2' }
      ]
    })).toThrowError()
  })

  it('normalizes lossless JSON string options before building the select field', () => {
    const protocol = buildQuestionProtocol({
      prompt: 'Pick one',
      options: JSON.stringify([
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' }
      ])
    })

    const form = getFormComponent(protocol)
    expect(form.fields[0].options).toEqual([
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' }
    ])
  })

  it('supports text fields and blocks options on text', () => {
    const protocol = buildQuestionProtocol({
      prompt: 'Provide info',
      fields: [
        { id: 'neInfo', label: '网元信息', type: 'text' },
        { id: 'neVersion', label: '网元版本', type: 'text' }
      ]
    })
    const form = getFormComponent(protocol)
    expect(form.fields.map(field => field.type)).toEqual(['text', 'text'])

    const invalidTextField = {
      id: 'neInfo',
      label: '网元信息',
      type: 'text',
      options: []
    } as unknown as {
      id: string
      label: string
      type: 'text'
    }

    expect(() => buildQuestionProtocol({
      prompt: 'Provide info',
      fields: [invalidTextField]
    })).toThrowError()
  })

  it('preserves field-level required metadata without forcing select defaults', () => {
    const protocol = buildQuestionProtocol({
      prompt: 'Provide info',
      required: true,
      fields: [
        {
          id: 'mode',
          label: '模式',
          type: 'select',
          required: false,
          options: [
            { label: 'A', value: 'A' },
            { label: 'B', value: 'B' }
          ]
        },
        {
          id: 'task',
          label: '任务',
          type: 'text',
          required: true
        }
      ]
    })

    const form = getFormComponent(protocol)
    expect(form.fields[0]).toMatchObject({
      id: 'mode',
      required: false,
      value: ''
    })
    expect(form.fields[1]).toMatchObject({
      id: 'task',
      required: true,
      value: ''
    })
    expect(form.fields[2]).toMatchObject({
      id: 'notes',
      required: false,
      value: ''
    })
  })

  it('infers optional field metadata from explicit optional wording when required is omitted', () => {
    const protocol = buildQuestionProtocol({
      prompt: 'Provide APN info',
      required: true,
      fields: [
        {
          id: 'apnName',
          label: 'APN名称',
          type: 'text',
          required: true
        },
        {
          id: 'bizDesc',
          label: '业务描述（可选）',
          type: 'text',
          placeholder: '可选，填写业务场景或备注'
        }
      ]
    })

    const form = getFormComponent(protocol)
    expect(form.fields[1]).toMatchObject({
      id: 'bizDesc',
      required: false,
      value: ''
    })
  })

  it('rejects duplicate field ids, duplicate option values, and empty option values', () => {
    expect(() => buildQuestionProtocol({
      prompt: 'Duplicate fields',
      fields: [
        { id: 'same', label: 'A', type: 'text' },
        { id: 'same', label: 'B', type: 'text' }
      ]
    })).toThrowError(/field ids must be unique/i)

    expect(() => buildQuestionProtocol({
      prompt: 'Duplicate options',
      fields: [{
        id: 'mode',
        label: '模式',
        type: 'select',
        options: [
          { label: 'A', value: 'same' },
          { label: 'B', value: 'same' }
        ]
      }]
    })).toThrowError(/option values must be unique/i)

    expect(() => buildQuestionProtocol({
      prompt: 'Empty option',
      options: [
        { label: 'A', value: '' },
        { label: 'B', value: 'b' }
      ]
    })).toThrowError(/cannot be empty strings/i)
  })
})
