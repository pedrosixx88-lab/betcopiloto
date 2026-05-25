import crypto from 'crypto'

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_KEYLEN = 32
const PBKDF2_DIGEST = 'sha256'
const SALT_HEX = 'betcopiloto-pix-v1'

function deriveKey(secret: string): Buffer {
  return crypto.pbkdf2Sync(secret, SALT_HEX, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
}

export function encryptPixKey(value: string): string {
  const secret = process.env.PIX_ENCRYPTION_KEY
  if (!secret) throw new Error('PIX_ENCRYPTION_KEY não configurada')
  const iv = crypto.randomBytes(16)
  const key = deriveKey(secret)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `enc2:${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptPixKey(value: string): string {
  if (!value.startsWith('enc')) return value
  const secret = process.env.PIX_ENCRYPTION_KEY
  if (!secret) throw new Error('PIX_ENCRYPTION_KEY não configurada')

  // Suporte a formato legado enc: (SHA256) — migrar na próxima escrita
  if (value.startsWith('enc:')) {
    const [, ivHex, encHex] = value.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const key = crypto.createHash('sha256').update(secret).digest()
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
  }

  // Formato atual enc2:
  const [, ivHex, encHex] = value.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const key = deriveKey(secret)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
}
