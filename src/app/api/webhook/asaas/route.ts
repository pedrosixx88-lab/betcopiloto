import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPaymentReceiptEmail } from '@/lib/email'
import { asaasPost } from '../../../../lib/asaas'

export const dynamic = 'force-dynamic'

const PLAN_PRICE = 49.90

export async function POST(request: NextRequest) {
  // Verificar token de autenticação do Asaas
  const token = request.headers.get('asaas-access-token')
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { event, payment } = body

  if (!payment) return NextResponse.json({ ok: true })

  const admin = createAdminClient()
  const userId: string = payment.externalReference

  if (!userId) return NextResponse.json({ ok: true })

  // Pagamento confirmado/recebido → ativar Pro
  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    // Ativar plano Pro
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('profiles').update({
      plan: 'pro',
      plan_expires_at: expiresAt.toISOString(),
      asaas_customer_id: payment.customer,
    }).eq('id', userId)

    // Atualizar subscription
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('subscriptions').upsert({
      user_id: userId,
      asaas_payment_id: payment.id,
      asaas_customer_id: payment.customer,
      status: 'active',
      plan: 'pro',
      amount: PLAN_PRICE,
      started_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    }, { onConflict: 'asaas_payment_id' })

    // Se é primeiro pagamento, criar assinatura recorrente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sub } = await (admin as any)
      .from('subscriptions')
      .select('asaas_subscription_id')
      .eq('user_id', userId)
      .single()

    if (!sub?.asaas_subscription_id) {
      try {
        // Verificar se tem split de afiliado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (admin as any)
          .from('profiles')
          .select('referred_by')
          .eq('id', userId)
          .single()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let splits: any[] = []
        if (profile?.referred_by) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: affiliate } = await (admin as any)
            .from('affiliates')
            .select('id, asaas_wallet_id, total_earned, pending_payout, active_referrals, total_referrals')
            .eq('code', profile.referred_by)
            .single()

          if (affiliate?.asaas_wallet_id) {
            splits = [{ walletId: affiliate.asaas_wallet_id, percentageValue: 30 }]
          }

          // Registrar comissão manual (fallback sem wallet)
          if (affiliate && !affiliate.asaas_wallet_id) {
            const commission = parseFloat((PLAN_PRICE * 0.30).toFixed(2))
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
              total_referrals: (affiliate.total_referrals ?? 0) + 1,
            }).eq('id', affiliate.id)
          }
        }

        // Criar assinatura recorrente
        const nextDue = new Date()
        nextDue.setMonth(nextDue.getMonth() + 1)

        const subscription = await asaasPost('/subscriptions', {
          customer: payment.customer,
          billingType: payment.billingType ?? 'UNDEFINED',
          value: PLAN_PRICE,
          cycle: 'MONTHLY',
          nextDueDate: nextDue.toISOString().split('T')[0],
          description: 'BetCopiloto Pro — Mensal',
          externalReference: userId,
          ...(splits.length > 0 && { split: splits }),
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('subscriptions').update({
          asaas_subscription_id: subscription.id,
        }).eq('user_id', userId).eq('asaas_payment_id', payment.id)
      } catch (err) {
        console.error('[webhook/asaas] erro ao criar subscription recorrente:', err)
      }
    }

    // Enviar e-mail de recibo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userProfile } = await (admin as any)
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .single()

    if (userProfile?.email) {
      await sendPaymentReceiptEmail(userProfile.email, userProfile.name ?? 'apostador').catch(() => {})
    }
  }

  // Assinatura cancelada/inadimplente → reverter para Free
  if (event === 'PAYMENT_OVERDUE' || event === 'SUBSCRIPTION_DELETED') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('profiles').update({
      plan: 'free',
      asaas_customer_id: payment.customer ?? null,
    }).eq('id', userId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('subscriptions').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    }).eq('user_id', userId).eq('status', 'active')

    // Reverter comissão de afiliado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: referral } = await (admin as any)
      .from('affiliate_referrals')
      .select('id, affiliate_id, commission')
      .eq('referred_user_id', userId)
      .single()

    if (referral) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('affiliate_referrals').update({ status: 'cancelled' }).eq('id', referral.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: aff } = await (admin as any)
        .from('affiliates')
        .select('active_referrals, pending_payout')
        .eq('id', referral.affiliate_id)
        .single()
      if (aff) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('affiliates').update({
          active_referrals: Math.max(0, (aff.active_referrals ?? 1) - 1),
          pending_payout: Math.max(0, (aff.pending_payout ?? 0) - referral.commission),
        }).eq('id', referral.affiliate_id)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
