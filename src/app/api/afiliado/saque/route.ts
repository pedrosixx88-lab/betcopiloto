import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPixKey } from '@/lib/pix-crypto'

export const dynamic = 'force-dynamic'

const ASAAS_BASE = 'https://api.asaas.com/v3'

const PIX_TYPE_MAP: Record<string, string> = {
  cpf:       'CPF',
  email:     'EMAIL',
  telefone:  'PHONE',
  aleatoria: 'EVP',
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: affiliate } = await (admin as any)
    .from('affiliates')
    .select('id, pending_payout, pix_key, pix_key_type, active_referrals')
    .eq('user_id', user.id)
    .single()

  if (!affiliate) return NextResponse.json({ error: 'Afiliado não encontrado' }, { status: 404 })
  if (!affiliate.pix_key) return NextResponse.json({ error: 'Cadastre sua chave Pix antes de sacar' }, { status: 400 })
  if ((affiliate.active_referrals ?? 0) < 1) return NextResponse.json({ error: 'Você precisa indicar pelo menos 1 cliente para sacar' }, { status: 400 })
  if ((affiliate.pending_payout ?? 0) <= 0) return NextResponse.json({ error: 'Você não tem saldo disponível para saque' }, { status: 400 })

  const amount = parseFloat(Number(affiliate.pending_payout).toFixed(2))

  // Bloquear saque duplo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from('affiliate_payouts')
    .select('id')
    .eq('affiliate_id', affiliate.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Você já tem um saque pendente em processamento' }, { status: 400 })

  const asaasKey = process.env.ASAAS_API_KEY

  // Se não tem Asaas configurado, registra e avisa que será manual
  if (!asaasKey) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('affiliate_payouts').insert({
      affiliate_id: affiliate.id,
      amount,
      status: 'pending',
      pix_key: affiliate.pix_key,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('affiliates').update({ pending_payout: 0 }).eq('id', affiliate.id)
    return NextResponse.json({ success: true, message: 'Saque registrado. Processamento em até 1 dia útil.' })
  }

  // Enviar Pix via Asaas
  const asaasRes = await fetch(`${ASAAS_BASE}/transfers`, {
    method: 'POST',
    headers: {
      'access_token': asaasKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      value: amount,
      pixAddressKey: decryptPixKey(affiliate.pix_key),
      pixAddressKeyType: PIX_TYPE_MAP[affiliate.pix_key_type] ?? 'EMAIL',
      description: 'Comissão de afiliado BetCopiloto',
      scheduleDate: new Date().toISOString().split('T')[0],
    }),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let asaasData: any = null
  let asaasError = false

  if (!asaasRes.ok) {
    console.error('[saque] Asaas error status:', asaasRes.status)
    asaasError = true
  } else {
    asaasData = await asaasRes.json()
  }

  // Registrar payout
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('affiliate_payouts').insert({
    affiliate_id: affiliate.id,
    amount,
    status: asaasError ? 'pending' : 'paid',
    pix_key: affiliate.pix_key,
    paid_at: asaasError ? null : new Date().toISOString(),
  })

  // Zerar saldo pendente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('affiliates').update({ pending_payout: 0 }).eq('id', affiliate.id)

  if (asaasError) {
    return NextResponse.json({
      success: true,
      message: 'Saque registrado. Será processado manualmente em até 1 dia útil.',
    })
  }

  return NextResponse.json({ success: true, transfer_id: asaasData?.id })
}
