import { getWebApiBase } from '@/config/apiConfig'
import type { MmlSchemaResponse, MmlTypeVersionOptions } from './types'

const MML_SCHEMA_API_BASE = `${getWebApiBase()}/mml`

interface ApiSuccess<T> {
  success: boolean
  data: T
  error?: string
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...(init || {}),
    credentials: 'include'
  })
  const payload = await response.json() as ApiSuccess<T>
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `HTTP ${response.status}`)
  }
  return payload.data
}

export const mmlSchemaApi = {
  async getOptions(): Promise<MmlTypeVersionOptions> {
    return requestJson<MmlTypeVersionOptions>(`${MML_SCHEMA_API_BASE}/options`)
  },
  async getSchema(networkType: string, networkVersion: string): Promise<MmlSchemaResponse | null> {
    const query = new URLSearchParams({
      networkType,
      networkVersion
    })
    const payload = await requestJson<{ schema: MmlSchemaResponse | null }>(
      `${MML_SCHEMA_API_BASE}/schema?${query.toString()}`
    )
    return payload.schema
  }
}
