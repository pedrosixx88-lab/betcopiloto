import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const MP_BASE = 'https://api.mercadopago.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect('/login')

  const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!mpToken) {
    return NextResponse.json({ error: 'Pagamento não configurado.' }, { status: 503 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('mp_subscription_id')
    .eq('id', user.id)
    .single<{ mp_subscription_id: string | null }>()

  if (!profile?.mp_subscription_id) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/planos?msg=sem_assinatura`)
  }

  const res = await fetch(`${MP_BASE}/preapproval/${profile.mp_subscription_id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mpToken}`,
    },
    body: JSON.stringify({ status: 'cancelled' }),
  })

  if (!res.ok) {
    console.error('[checkout/cancelar] MP error:', await res.text())
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/planos?msg=erro_cancelar`)
  }

  // Atualizar plano no banco
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('profiles').update({
    plan: 'free',
    mp_subscription_id: null,
    plan_expires_at: new Date().toISOString(),
  }).eq('id', user.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('subscriptions').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
  }).eq('user_id', user.id).eq('status', 'active')

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/planos?msg=cancelado`)
}
