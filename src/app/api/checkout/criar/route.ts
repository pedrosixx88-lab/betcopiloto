import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateCustomer, asaasPost } from '@/lib/asaas'

function isValidCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i)
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cpf[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i)
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  return remainder === parseInt(cpf[10])
}

export const dynamic = 'force-dynamic'

const PLAN_PRICE = 49.90

// GET: redireciona para página de checkout que coleta CPF
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single<{ plan: string }>()

  if (profile?.plan === 'pro') {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/planos?msg=ja_pro`)
  }

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/checkout`)
}

// POST: recebe CPF e cria cobrança no Asaas
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, plan')
    .eq('id', user.id)
    .single<{ name: string; plan: string }>()

  if (profile?.plan === 'pro') {
    return NextResponse.json({ error: 'Você já é Pro.' }, { status: 400 })
  }

  const body = await request.json()
  const cpf = body.cpf?.replace(/\D/g, '')
  if (!cpf || !isValidCPF(cpf)) {
    return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // 1. Criar ou buscar customer no Asaas (com CPF)
    const customer = await getOrCreateCustomer(
      user.email!,
      profile?.name ?? user.email!,
      user.id,
      cpf,
    )

    // 2. Verificar se tem afiliado para configurar split
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profileFull } = await (admin as any)
      .from('profiles')
      .select('referred_by')
      .eq('id', user.id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let splits: any[] = []
    if (profileFull?.referred_by) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: affiliate } = await (admin as any)
        .from('affiliates')
        .select('asaas_wallet_id')
        .eq('code', profileFull.referred_by)
        .single()

      if (affiliate?.asaas_wallet_id) {
        splits = [{ walletId: affiliate.asaas_wallet_id, percentageValue: 30 }]
      }
    }

    // 3. Criar link de pagamento
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://betcopiloto.com.br'
    const payment = await asaasPost('/payments', {
      customer: customer.id,
      billingType: 'UNDEFINED',
      value: PLAN_PRICE,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: 'BetCopiloto Pro — Mensal',
      externalReference: user.id,
      callback: { successUrl: `${appUrl}/checkout/sucesso` },
      ...(splits.length > 0 && { split: splits }),
    })

    // 4. Salvar payment pendente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('subscriptions').insert({
      user_id: user.id,
      asaas_payment_id: payment.id,
      asaas_customer_id: customer.id,
      status: 'pending',
      plan: 'pro',
      amount: PLAN_PRICE,
    })

    return NextResponse.json({ url: payment.invoiceUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[checkout/criar] erro ao criar cobrança:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
