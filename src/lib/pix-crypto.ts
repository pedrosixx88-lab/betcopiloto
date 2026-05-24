import crypto from 'crypto'

export function encryptPixKey(value: string): string {
  const secret = process.env.PIX_ENCRYPTION_KEY
  if (!secret) throw new Error('PIX_ENCRYPTION_KEY não configurada')
  const iv = crypto.randomBytes(16)
  const key = crypto.createHash('sha256').update(secret).digest()
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `enc:${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptPixKey(value: string): string {
  if (!value.startsWith('enc:')) return value
  const secret = process.env.PIX_ENCRYPTION_KEY
  if (!secret) throw new Error('PIX_ENCRYPTION_KEY não configurada')
  const [, ivHex, encHex] = value.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const key = crypto.createHash('sha256').update(secret).digest()
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
}
