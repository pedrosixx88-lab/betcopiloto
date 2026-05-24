import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function encryptPixKey(value: string): string {
  const secret = process.env.PIX_ENCRYPTION_KEY
  if (!secret) throw new Error('PIX_ENCRYPTION_KEY não configurada')
  const iv = crypto.randomBytes(16)
  const key = crypto.createHash('sha256').update(secret).digest()
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `enc:${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { pix_key, pix_key_type } = await request.json()
  if (!pix_key || !pix_key_type) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('affiliates')
    .update({ pix_key: encryptPixKey(pix_key), pix_key_type })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
  return NextResponse.json({ success: true })
}
