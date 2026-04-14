const UTF8_BOM_BYTES = new Uint8Array([0xef, 0xbb, 0xbf])
const UTF16_LE_BOM_BYTES = new Uint8Array([0xff, 0xfe])
const UTF16_BE_BOM_BYTES = new Uint8Array([0xfe, 0xff])
const ALLOWED_CONTROL_CODES = new Set([0x09, 0x0a, 0x0d])
const MAX_SUSPICIOUS_BYTE_RATIO = 0.1
const UNSUPPORTED_UPLOAD_MESSAGE = 'Upload content encoding is unsupported or file is not valid text'

type BomEncoding = 'utf-8' | 'utf-16le' | 'utf-16be'
export type SupportedUploadEncoding = BomEncoding | 'gb18030'

export interface NormalizedUploadText {
  content: string
  encoding: SupportedUploadEncoding
}

export class UnsupportedUploadEncodingError extends Error {
  readonly code = 'UPLOAD_UNSUPPORTED_ENCODING'

  constructor(message = UNSUPPORTED_UPLOAD_MESSAGE) {
    super(message)
    this.name = 'UnsupportedUploadEncodingError'
  }
}

export function normalizeUploadedText(buffer: Uint8Array): NormalizedUploadText {
  const bomEncoding = detectBomEncoding(buffer)
  if (bomEncoding) {
    return {
      content: decodeText(stripBom(buffer, bomEncoding), bomEncoding),
      encoding: bomEncoding
    }
  }
  if (containsNullByte(buffer) || hasTooManySuspiciousBytes(buffer)) {
    throw new UnsupportedUploadEncodingError()
  }
  if (canDecodeUtf8(buffer)) {
    return {
      content: decodeText(buffer, 'utf-8'),
      encoding: 'utf-8'
    }
  }
  const content = decodeText(buffer, 'gb18030')
  assertTextContent(content)
  return { content, encoding: 'gb18030' }
}

function detectBomEncoding(buffer: Uint8Array): BomEncoding | null {
  if (startsWithBytes(buffer, UTF8_BOM_BYTES)) return 'utf-8'
  if (startsWithBytes(buffer, UTF16_LE_BOM_BYTES)) return 'utf-16le'
  if (startsWithBytes(buffer, UTF16_BE_BOM_BYTES)) return 'utf-16be'
  return null
}

function startsWithBytes(buffer: Uint8Array, prefix: Uint8Array): boolean {
  if (buffer.length < prefix.length) return false
  return prefix.every((value, index) => buffer[index] === value)
}

function stripBom(buffer: Uint8Array, encoding: BomEncoding): Uint8Array {
  if (encoding === 'utf-8') return buffer.slice(UTF8_BOM_BYTES.length)
  return buffer.slice(UTF16_LE_BOM_BYTES.length)
}

function canDecodeUtf8(buffer: Uint8Array): boolean {
  try {
    decodeText(buffer, 'utf-8')
    return true
  } catch {
    return false
  }
}

function decodeText(buffer: Uint8Array, encoding: SupportedUploadEncoding | BomEncoding): string {
  return new TextDecoder(encoding, { fatal: true }).decode(buffer)
}

function containsNullByte(buffer: Uint8Array): boolean {
  return buffer.includes(0x00)
}

function hasTooManySuspiciousBytes(buffer: Uint8Array): boolean {
  if (!buffer.length) return false
  const suspiciousCount = buffer.reduce((count, byte) => count + Number(isSuspiciousByte(byte)), 0)
  return suspiciousCount / buffer.length > MAX_SUSPICIOUS_BYTE_RATIO
}

function isSuspiciousByte(byte: number): boolean {
  return byte <= 0x08
    || byte === 0x0b
    || (byte >= 0x0e && byte <= 0x1f)
    || byte === 0x7f
}

function assertTextContent(content: string): void {
  const hasInvalidControl = Array.from(content).some(char => {
    const code = char.codePointAt(0) ?? 0
    if (code === 0xfffd) return true
    if (code === 0x00) return true
    return code < 0x20 && !ALLOWED_CONTROL_CODES.has(code)
  })
  if (hasInvalidControl) {
    throw new UnsupportedUploadEncodingError()
  }
}

