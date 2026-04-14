import { describe, expect, it } from 'vitest'
import {
  normalizeUploadedText,
  UnsupportedUploadEncodingError
} from './uploadTextNormalizer.js'

const UTF8_CONTENT = '中文内容\n'
const GB18030_HEX = 'd6d0cec4c4dac8dd0a'
const UTF16_LE_HEX = '2d4e87658551b95b0a00'
const UTF16_BE_HEX = '4e2d658751855bb9000a'

function bytesFromHex(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'))
}

function withBom(prefix: number[], bytes: Uint8Array): Uint8Array {
  return Uint8Array.from([...prefix, ...bytes])
}

describe('normalizeUploadedText', () => {
  it('keeps valid utf-8 text readable', () => {
    expect(normalizeUploadedText(Buffer.from(UTF8_CONTENT, 'utf8'))).toEqual({
      content: UTF8_CONTENT,
      encoding: 'utf-8'
    })
  })

  it('strips a utf-8 bom before persistence', () => {
    expect(normalizeUploadedText(withBom([0xef, 0xbb, 0xbf], Buffer.from(UTF8_CONTENT, 'utf8')))).toEqual({
      content: UTF8_CONTENT,
      encoding: 'utf-8'
    })
  })

  it('normalizes utf-16 bom text to plain utf-8 content', () => {
    expect(normalizeUploadedText(withBom([0xff, 0xfe], bytesFromHex(UTF16_LE_HEX)))).toEqual({
      content: UTF8_CONTENT,
      encoding: 'utf-16le'
    })
    expect(normalizeUploadedText(withBom([0xfe, 0xff], bytesFromHex(UTF16_BE_HEX)))).toEqual({
      content: UTF8_CONTENT,
      encoding: 'utf-16be'
    })
  })

  it('decodes gb18030-family chinese text', () => {
    expect(normalizeUploadedText(bytesFromHex(GB18030_HEX))).toEqual({
      content: UTF8_CONTENT,
      encoding: 'gb18030'
    })
  })

  it('rejects binary-looking uploads explicitly', () => {
    const binary = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
    expect(() => normalizeUploadedText(binary)).toThrow(UnsupportedUploadEncodingError)
  })
})

