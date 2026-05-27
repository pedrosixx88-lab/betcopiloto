import crypto from 'crypto'

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_KEYLEN = 32
const PBKDF2_DIGEST = 'sha256'

// enc3: salt aleatório por entrada — formato: enc3:{saltHex}:{ivHex}:{encHex}
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
}

export function encryptPixKey(value: string): string {
  const secret = process.env.PIX_ENCRYPTION_KEY
  if (!secret) throw new Error('PIX_ENCRYPTION_KEY não configurada')
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(16)
  const key = deriveKey(secret, salt)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `enc3:${salt.toString('hex')}:${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptPixKey(value: string): string {
  if (!value.startsWith('enc')) return value
  const secret = process.env.PIX_ENCRYPTION_KEY
  if (!secret) throw new Error('PIX_ENCRYPTION_KEY não configurada')

  // enc3: salt aleatório por entrada (formato atual)
  if (value.startsWith('enc3:')) {
    const [, saltHex, ivHex, encHex] = value.split(':')
    const salt = Buffer.from(saltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const key = deriveKey(secret, salt)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
  }

  // enc2: legado — salt fixo (PBKDF2 com salt estático)
  if (value.startsWith('enc2:')) {
    const LEGACY_SALT = Buffer.from('betcopiloto-pix-v1', 'utf8')
    const [, ivHex, encHex] = value.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const key = deriveKey(secret, LEGACY_SALT)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
  }

  // enc: legado — SHA256 simples
  if (value.startsWith('enc:')) {
    const [, ivHex, encHex] = value.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const key = crypto.createHash('sha256').update(secret).digest()
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
  }

  return value
}
