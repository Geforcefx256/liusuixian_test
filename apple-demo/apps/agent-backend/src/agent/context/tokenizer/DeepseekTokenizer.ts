import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Tokenizer as TokenizerPort } from '../types.js'

const TOKENIZER_DIR_NAME = 'deepseek_v3_tokenizer'
const TOKENIZER_CONFIG_NAME = 'tokenizer_config.json'
const DEFAULT_CONTEXT_WINDOW = 8192
const ENGLISH_CHAR_WEIGHT = 0.3
const CHINESE_CHAR_WEIGHT = 0.6
const OTHER_CHAR_WEIGHT = 1
const EMPTY_TOKENS = 0

interface TokenizerConfig {
  model_max_length?: number
}

export class DeepseekTokenizer implements TokenizerPort {
  private constructor() {}

  static load(): DeepseekTokenizer {
    return new DeepseekTokenizer()
  }

  static loadContextWindow(): number {
    const config = loadTokenizerConfig()
    const value = config.model_max_length
    if (!value || !Number.isFinite(value) || value <= 0) {
      return DEFAULT_CONTEXT_WINDOW
    }
    return Math.floor(value)
  }

  countTokens(text: string): number {
    if (!text) return EMPTY_TOKENS
    let englishEstimated = 0
    let chineseEstimated = 0
    let otherEstimated = 0
    for (const char of text) {
      if (isWhitespace(char)) {
        continue
      }
      if (isChinese(char)) {
        chineseEstimated += CHINESE_CHAR_WEIGHT
        continue
      }
      if (isEnglishLetter(char)) {
        englishEstimated += ENGLISH_CHAR_WEIGHT
        continue
      }
      otherEstimated += OTHER_CHAR_WEIGHT
    }
    return Math.ceil(englishEstimated) + Math.ceil(chineseEstimated) + Math.ceil(otherEstimated)
  }
}

function getTokenizerDir(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  return resolve(currentDir, '../../../../resources', TOKENIZER_DIR_NAME)
}

function loadTokenizerConfig(): TokenizerConfig {
  const configPath = resolve(getTokenizerDir(), TOKENIZER_CONFIG_NAME)
  const raw = readFileSync(configPath, 'utf-8')
  return JSON.parse(raw) as TokenizerConfig
}

function isWhitespace(char: string): boolean {
  return /\s/.test(char)
}

function isChinese(char: string): boolean {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(char)
}

function isEnglishLetter(char: string): boolean {
  return /[A-Za-z]/.test(char)
}
