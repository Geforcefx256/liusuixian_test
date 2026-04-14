import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import { getOAuthProviderConfig } from './config.js'

const CIPHER_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getEncryptionKey(): Buffer {
  const secret = getOAuthProviderConfig().tokenEncryptionKey
  if (!secret) {
    throw new Error('OAuth token encryption key is not configured')
  }
  return createHash('sha256').update(secret).digest()
}

export function encryptOAuthToken(token: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(CIPHER_ALGORITHM, getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv, authTag, encrypted]
    .map(part => part.toString('base64'))
    .join('.')
}

export function decryptOAuthToken(payload: string): string {
  const [ivBase64, authTagBase64, encryptedBase64] = payload.split('.')
  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted OAuth token payload')
  }

  const decipher = createDecipheriv(
    CIPHER_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivBase64, 'base64')
  )
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}
