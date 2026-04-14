/**
 * Embedding Provider
 *
 * Provides embedding generation for memory content.
 * Supports OpenAI and Zhipu AI embedding APIs.
 */

import type { EmbeddingProvider, EmbeddingProviderConfig } from './types.js'

/**
 * OpenAI embedding provider
 */
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openai'
  readonly model: string
  readonly dimensions: number
  private apiKey: string
  private baseUrl: string

  constructor(config: { apiKey: string; model?: string; baseUrl?: string; dimensions?: number }) {
    this.apiKey = config.apiKey
    this.model = config.model || 'text-embedding-3-small'
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1'
    this.dimensions = config.dimensions || 1536
  }

  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text])
    return embeddings[0]
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        encoding_format: 'float'
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI embedding API error: ${error}`)
    }

    const response_data = await response.json() as {
      data: Array<{ index: number; embedding: number[] }>
    }
    return response_data.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding)
  }
}

/**
 * Zhipu AI embedding provider
 */
class ZhipuEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'zhipu'
  readonly model: string
  readonly dimensions: number
  private apiKey: string
  private baseUrl: string

  constructor(config: { apiKey: string; model?: string; baseUrl?: string; dimensions?: number }) {
    this.apiKey = config.apiKey
    this.model = config.model || 'embedding-3'
    this.baseUrl = config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4'
    this.dimensions = config.dimensions || 512
  }

  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text])
    return embeddings[0]
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey  // Zhipu uses API key directly, no "Bearer"
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        dimensions: this.dimensions
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Zhipu embedding API error: ${error}`)
    }

    const response_data = await response.json() as {
      data: Array<{ index: number; embedding: number[] }>
    }
    return response_data.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding)
  }
}

/**
 * Null embedding provider (for FTS-only mode)
 */
class NullEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'none'
  readonly model = 'none'

  async embedQuery(_text: string): Promise<number[]> {
    return []
  }

  async embedBatch(_texts: string[]): Promise<number[][]> {
    return []
  }
}

/**
 * Create embedding provider
 */
export function createEmbeddingProvider(config: EmbeddingProviderConfig): EmbeddingProvider {
  if (config.provider === 'none' || !config.apiKey) {
    return new NullEmbeddingProvider()
  }

  if (config.provider === 'openai') {
    return new OpenAIEmbeddingProvider({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      dimensions: config.dimensions
    })
  }

  if (config.provider === 'zhipu') {
    return new ZhipuEmbeddingProvider({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      dimensions: config.dimensions
    })
  }

  throw new Error(`Unknown embedding provider: ${config.provider}`)
}

/**
 * Compute hash for content (for caching)
 */
export function computeContentHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(16)
}

/**
 * Normalize embedding vector
 */
export function normalizeEmbedding(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  if (magnitude < 1e-10) return vec
  return vec.map(v => v / magnitude)
}