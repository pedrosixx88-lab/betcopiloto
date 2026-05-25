import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptPixKey } from '@/lib/pix-crypto'

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['cpf', 'cnpj', 'email', 'phone', 'random'] as const
type PixKeyType = typeof VALID_TYPES[number]

const PIX_PATTERNS: Record<PixKeyType, RegExp> = {
  cpf:    /^\d{11}$/,
  cnpj:   /^\d{14}$/,
  email:  /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone:  /^\+55\d{10,11}$/,
  random: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { pix_key, pix_key_type } = body

  if (!pix_key || typeof pix_key !== 'string' || pix_key.length > 200) {
    return NextResponse.json({ error: 'Chave PIX inválida' }, { status: 400 })
  }
  if (!pix_key_type || !VALID_TYPES.includes(pix_key_type as PixKeyType)) {
    return NextResponse.json({ error: 'Tipo de chave PIX inválido' }, { status: 400 })
  }

  const pattern = PIX_PATTERNS[pix_key_type as PixKeyType]
  if (!pattern.test(pix_key.trim())) {
    return NextResponse.json({ error: `Formato de chave PIX inválido para tipo ${pix_key_type}` }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('affiliates')
    .update({ pix_key: encryptPixKey(pix_key.trim()), pix_key_type })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
  return NextResponse.json({ success: true })
}
