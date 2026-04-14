import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import RichResultCard from './RichResultCard.vue'

describe('RichResultCard', () => {
  it('keeps markdown artifact actions on the existing 打开文件 entry point', async () => {
    const wrapper = mount(RichResultCard, {
      props: {
        message: {
          id: 'msg-1',
          role: 'assistant',
          text: 'artifact',
          createdAt: 1,
          status: 'done',
          kind: 'result',
          result: {
            kind: 'artifact_ref',
            data: {
              fileId: 'file-1',
              fileKey: 'f_md01',
              fileName: 'review.md'
            }
          }
        }
      }
    })

    const action = wrapper.get('.rich-result-card__action')
    expect(action.text()).toBe('打开文件')

    await action.trigger('click')

    expect(wrapper.emitted('open-file')).toEqual([['f_md01']])
  })
})
