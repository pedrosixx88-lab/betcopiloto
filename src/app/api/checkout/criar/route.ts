import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const MP_BASE = 'https://api.mercadopago.com'
const PLAN_PRICE = 49.90

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect('/login')

  const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!mpToken) {
    return NextResponse.json({ error: 'Pagamento não configurado ainda.' }, { status: 503 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, plan')
    .eq('id', user.id)
    .single<{ name: string; plan: string }>()

  if (profile?.plan === 'pro') {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/planos?msg=ja_pro`)
  }

  // Criar preapproval (assinatura recorrente) no Mercado Pago
  const body = {
    reason: 'BetCopiloto Pro — Mensal',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: PLAN_PRICE,
      currency_id: 'BRL',
    },
    payer_email: user.email,
    back_url: `${process.env.NEXT_PUBLIC_APP_URL}/planos?msg=assinado`,
    status: 'pending',
    external_reference: user.id,
  }

  const res = await fetch(`${MP_BASE}/preapproval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mpToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[checkout/criar] MP error:', err)
    return NextResponse.json({ error: 'Erro ao criar assinatura.' }, { status: 500 })
  }

  const mp = await res.json()

  // Salvar subscription pendente
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('subscriptions').insert({
    user_id: user.id,
    mp_preapproval_id: mp.id,
    status: 'pending',
    plan: 'pro',
    amount: PLAN_PRICE,
  })

  // Redirecionar para o checkout do Mercado Pago
  return NextResponse.redirect(mp.init_point)
}
