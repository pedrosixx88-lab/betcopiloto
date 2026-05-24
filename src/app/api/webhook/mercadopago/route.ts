import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPaymentReceiptEmail } from '@/lib/email'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const MP_BASE = 'https://api.mercadopago.com'
const PLAN_PRICE = 29.90
const AFFILIATE_COMMISSION_PCT = 0.30

function verifySignature(request: NextRequest, rawBody: string): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!secret) return false // bloquear sempre se secret não configurado

  const xSignature = request.headers.get('x-signature') ?? ''
  const xRequestId = request.headers.get('x-request-id') ?? ''
  const urlParams = request.nextUrl.searchParams
  const dataId = urlParams.get('data.id') ?? ''

  // MP assina: "id:{dataId};request-id:{xRequestId};ts:{ts};"
  const parts = xSignature.split(',')
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1] ?? ''
  const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1] ?? ''

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  return hash === v1
}

async function fetchPreapproval(preapprovalId: string) {
  const res = await fetch(`${MP_BASE}/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}` },
  })
  if (!res.ok) return null
  return res.json()
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!verifySignature(request, rawBody)) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  let event: { type: string; data: { id: string } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Só processar eventos de assinatura
  if (event.type !== 'subscription_preapproval') {
    return NextResponse.json({ ok: true })
  }

  const preapproval = await fetchPreapproval(event.data.id)
  if (!preapproval) return NextResponse.json({ error: 'Preapproval não encontrado' }, { status: 404 })

  const userId: string = preapproval.external_reference
  if (!userId) return NextResponse.json({ error: 'external_reference ausente' }, { status: 400 })

  const admin = createAdminClient()
  const status: string = preapproval.status // authorized | paused | cancelled | pending

  if (status === 'authorized') {
    // Ativar plano Pro — 30 dias a partir de hoje
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('profiles').update({
      plan: 'pro',
      plan_expires_at: expiresAt.toISOString(),
      mp_subscription_id: preapproval.id,
    }).eq('id', userId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('subscriptions').upsert({
      user_id: userId,
      mp_subscription_id: preapproval.id,
      mp_preapproval_id: preapproval.id,
      status: 'active',
      plan: 'pro',
      amount: PLAN_PRICE,
      started_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    }, { onConflict: 'mp_preapproval_id' })

    // Processar comissão de afiliado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (admin as any)
      .from('profiles')
      .select('referred_by')
      .eq('id', userId)
      .single()

    // Enviar e-mail de recibo
    const { data: userProfile } = await (admin as any)
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .single()
    if (userProfile?.email) {
      await sendPaymentReceiptEmail(userProfile.email, userProfile.name ?? 'apostador').catch(() => {})
    }

    if (profile?.referred_by) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: affiliate } = await (admin as any)
        .from('affiliates')
        .select('id, total_earned, pending_payout, active_referrals')
        .eq('code', profile.referred_by)
        .single()

      if (affiliate) {
        const commission = parseFloat((PLAN_PRICE * AFFILIATE_COMMISSION_PCT).toFixed(2))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('affiliate_referrals').upsert({
          affiliate_id: affiliate.id,
          referred_user_id: userId,
          status: 'active',
          plan: 'pro',
          commission,
          activated_at: new Date().toISOString(),
        }, { onConflict: 'referred_user_id' })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('affiliates').update({
          total_earned: (affiliate.total_earned ?? 0) + commission,
          pending_payout: (affiliate.pending_payout ?? 0) + commission,
          active_referrals: (affiliate.active_referrals ?? 0) + 1,
          total_referrals: affiliate.total_referrals + 1,
        }).eq('id', affiliate.id)
      }
    }
  }

  if (status === 'cancelled' || status === 'paused') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('profiles').update({
      plan: 'free',
      mp_subscription_id: null,
    }).eq('id', userId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('subscriptions').update({
      status: status === 'cancelled' ? 'cancelled' : 'paused',
      cancelled_at: status === 'cancelled' ? new Date().toISOString() : null,
    }).eq('mp_preapproval_id', preapproval.id)

    // Marcar referral como cancelado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: referral } = await (admin as any)
      .from('affiliate_referrals')
      .select('id, affiliate_id, commission')
      .eq('referred_user_id', userId)
      .single()

    if (referral) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('affiliate_referrals').update({ status: 'cancelled' }).eq('id', referral.id)

      // Decrementar afiliado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: affiliate } = await (admin as any)
        .from('affiliates')
        .select('active_referrals, pending_payout')
        .eq('id', referral.affiliate_id)
        .single()

      if (affiliate) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('affiliates').update({
          active_referrals: Math.max(0, (affiliate.active_referrals ?? 1) - 1),
          pending_payout: Math.max(0, (affiliate.pending_payout ?? 0) - referral.commission),
        }).eq('id', referral.affiliate_id)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
