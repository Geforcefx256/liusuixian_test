import { IncomingMessage, ServerResponse } from 'node:http'
import { Duplex } from 'node:stream'
import type { Express } from 'express'

class MockSocket extends Duplex {
  remoteAddress = '127.0.0.1'
  writable = true
  readable = true

  _read(): void {}

  _write(
    _chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    callback()
  }

  setTimeout(): this {
    return this
  }

  setNoDelay(): this {
    return this
  }

  setKeepAlive(): this {
    return this
  }

  override destroy(error?: Error): this {
    if (error) {
      this.emit('error', error)
    }
    this.emit('close')
    return this
  }
}

interface InvokeAppOptions {
  method?: string
  path: string
  headers?: Record<string, string>
  body?: string
}

export interface AppResponse {
  status: number
  headers: Record<string, string | string[]>
  text: string
  json<T>(): T
}

export async function invokeApp(app: Express, options: InvokeAppOptions): Promise<AppResponse> {
  const request = createRequest(options)
  const response = createResponse(request.req)
  const text = await dispatch(app, request.req, response.res)
  return {
    status: response.res.statusCode,
    headers: toHeaderRecord(response.res.getHeaders()),
    text,
    json<T>() {
      return JSON.parse(text) as T
    }
  }
}

function createRequest(options: InvokeAppOptions): { req: IncomingMessage; socket: MockSocket } {
  const socket = new MockSocket()
  const req = new IncomingMessage(socket)
  req.method = options.method || 'GET'
  req.url = options.path
  req.headers = normalizeHeaders(options.headers, options.body)
  if (options.body) {
    req.push(options.body)
  }
  req.push(null)
  return { req, socket }
}

function createResponse(req: IncomingMessage): { res: ServerResponse } {
  const socket = new MockSocket()
  const res = new ServerResponse(req)
  res.assignSocket(socket)
  return { res }
}

function dispatch(app: Express, req: IncomingMessage, res: ServerResponse): Promise<string> {
  const chunks: Buffer[] = []
  const originalWrite = res.write.bind(res)
  const originalEnd = res.end.bind(res)

  res.write = ((chunk: unknown, encoding?: BufferEncoding, callback?: (error?: Error | null) => void) => {
    pushChunk(chunks, chunk, encoding)
    return originalWrite(chunk as never, encoding, callback)
  }) as typeof res.write

  res.end = ((chunk?: unknown, encoding?: BufferEncoding, callback?: () => void) => {
    pushChunk(chunks, chunk, encoding)
    return originalEnd(chunk as never, encoding, callback)
  }) as typeof res.end

  return new Promise((resolve, reject) => {
    res.on('finish', () => resolve(Buffer.concat(chunks).toString('utf8')))
    res.on('error', reject)
    app.handle(req, res, reject)
  })
}

function pushChunk(chunks: Buffer[], chunk: unknown, encoding?: BufferEncoding): void {
  if (typeof chunk === 'string') {
    chunks.push(Buffer.from(chunk, encoding))
    return
  }
  if (Buffer.isBuffer(chunk)) {
    chunks.push(chunk)
  }
}

function normalizeHeaders(
  headers: Record<string, string> | undefined,
  body: string | undefined
): Record<string, string> {
  const normalized = Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => [key.toLowerCase(), value])
  )
  if (body && !normalized['content-length']) {
    normalized['content-length'] = String(Buffer.byteLength(body))
  }
  return normalized
}

function toHeaderRecord(
  headers: ReturnType<ServerResponse['getHeaders']>
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      result[key] = value.map(item => String(item))
      continue
    }
    if (typeof value === 'number') {
      result[key] = String(value)
      continue
    }
    if (typeof value === 'string') {
      result[key] = value
    }
  }
  return result
}
