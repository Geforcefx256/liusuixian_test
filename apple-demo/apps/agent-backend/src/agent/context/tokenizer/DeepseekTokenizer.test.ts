import { describe, expect, it } from 'vitest'
import { DeepseekTokenizer } from './DeepseekTokenizer.js'

const ENGLISH_SAMPLE = 'Hello'
const CHINESE_SAMPLE = '你好'
const SYMBOL_SAMPLE = '!?'
const DIGIT_SAMPLE = '123'
const MIXED_SAMPLE = 'Hi 你好!'

const EXPECTED_ENGLISH = 2
const EXPECTED_CHINESE = 2
const EXPECTED_SYMBOL = 2
const EXPECTED_DIGIT = 3
const EXPECTED_MIXED = 4
const EXPECTED_EMPTY = 0
const EXPECTED_WHITESPACE = 0

function createTokenizer(): DeepseekTokenizer {
  return DeepseekTokenizer.load()
}

describe('DeepseekTokenizer', () => {
  it('estimates english tokens using ratio rounding up', () => {
    const tokenizer = createTokenizer()
    expect(tokenizer.countTokens(ENGLISH_SAMPLE)).toBe(EXPECTED_ENGLISH)
  })

  it('estimates chinese tokens using ratio rounding up', () => {
    const tokenizer = createTokenizer()
    expect(tokenizer.countTokens(CHINESE_SAMPLE)).toBe(EXPECTED_CHINESE)
  })

  it('counts digits and symbols as whole tokens', () => {
    const tokenizer = createTokenizer()
    expect(tokenizer.countTokens(SYMBOL_SAMPLE)).toBe(EXPECTED_SYMBOL)
    expect(tokenizer.countTokens(DIGIT_SAMPLE)).toBe(EXPECTED_DIGIT)
  })

  it('ignores whitespace and mixes weights', () => {
    const tokenizer = createTokenizer()
    expect(tokenizer.countTokens(MIXED_SAMPLE)).toBe(EXPECTED_MIXED)
    expect(tokenizer.countTokens('')).toBe(EXPECTED_EMPTY)
    expect(tokenizer.countTokens('   ')).toBe(EXPECTED_WHITESPACE)
  })
})
