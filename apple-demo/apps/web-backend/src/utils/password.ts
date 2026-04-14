import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const PASSWORD_KEY_LENGTH = 64

export function hashPassword(password: string, saltHex = randomBytes(16).toString('hex')): string {
  const derivedKey = scryptSync(password, Buffer.from(saltHex, 'hex'), PASSWORD_KEY_LENGTH)
  return `scrypt$${saltHex}$${derivedKey.toString('hex')}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, saltHex, expectedHex] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !saltHex || !expectedHex) {
    return false
  }

  const derivedKey = scryptSync(password, Buffer.from(saltHex, 'hex'), PASSWORD_KEY_LENGTH)
  const expected = Buffer.from(expectedHex, 'hex')
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey)
}
