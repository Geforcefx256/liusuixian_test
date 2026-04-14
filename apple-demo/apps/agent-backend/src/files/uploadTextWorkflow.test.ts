import { readFile, rm } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FileStore, type WorkspaceScope } from './fileStore.js'
import {
  normalizeUploadedText,
  UnsupportedUploadEncodingError
} from './uploadTextNormalizer.js'
import { openWorkspaceFile, saveWorkspaceFile } from './workspaceFileEditor.js'

const TEXT_CONTENT = '中文内容\n'
const scope: WorkspaceScope = {
  userId: 999101,
  agentId: 'workspace-upload-encoding-test'
}

function bytesFromHex(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'))
}

function withBom(prefix: number[], bytes: Uint8Array): Uint8Array {
  return Uint8Array.from([...prefix, ...bytes])
}

describe('uploaded text normalization workflow', () => {
  let store: FileStore

  beforeEach(async () => {
    store = new FileStore()
    await store.initialize()
  })

  afterEach(async () => {
    await rm(store.getWorkspaceRoot(scope), { recursive: true, force: true })
  })

  it.each([
    ['utf-8', Buffer.from(TEXT_CONTENT, 'utf8')],
    ['utf-8 bom', withBom([0xef, 0xbb, 0xbf], Buffer.from(TEXT_CONTENT, 'utf8'))],
    ['utf-16le bom', withBom([0xff, 0xfe], bytesFromHex('2d4e87658551b95b0a00'))],
    ['utf-16be bom', withBom([0xfe, 0xff], bytesFromHex('4e2d658751855bb9000a'))],
    ['gb18030', bytesFromHex('d6d0cec4c4dac8dd0a')]
  ])('persists %s uploads as readable utf-8 text', async (_label, bytes) => {
    const normalized = normalizeUploadedText(bytes)
    const upload = await store.writeUpload({
      originalName: 'input.txt',
      content: Buffer.from(normalized.content, 'utf8'),
      scope
    })

    expect(await readFile(store.getUploadEntryPath(upload.entry), 'utf8')).toBe(TEXT_CONTENT)
    expect(await openWorkspaceFile(upload.entry)).toMatchObject({
      fileKey: upload.entry.fileKey,
      fileName: 'input.txt',
      content: TEXT_CONTENT
    })
    expect(await readFile(store.getUploadEntryPath(upload.entry))).toEqual(Buffer.from(TEXT_CONTENT, 'utf8'))
  })

  it('keeps normalized uploads readable after save and reopen', async () => {
    const normalized = normalizeUploadedText(bytesFromHex('d6d0cec4c4dac8dd0a'))
    const upload = await store.writeUpload({
      originalName: 'notes.txt',
      content: Buffer.from(normalized.content, 'utf8'),
      scope
    })

    const saved = await saveWorkspaceFile(upload.entry, {
      content: '中文已更新\n',
      mode: 'text'
    })

    expect(saved.content).toBe('中文已更新\n')
    expect(await openWorkspaceFile(upload.entry)).toMatchObject({
      fileKey: upload.entry.fileKey,
      content: '中文已更新\n'
    })
    expect(await readFile(store.getUploadEntryPath(upload.entry))).toEqual(Buffer.from('中文已更新\n', 'utf8'))
  })

  it('fails unsupported bytes explicitly before persistence', async () => {
    const binary = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])

    expect(() => normalizeUploadedText(binary)).toThrow(UnsupportedUploadEncodingError)
    expect(store.listWorkspaceEntries(scope)).toHaveLength(0)
  })
})

