import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Users, DollarSign, TrendingUp, Copy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import AfiliadoCopyButton from '@/components/afiliado/copy-button'
import SaqueForm from '@/components/afiliado/saque-form'

export default async function AfiliadoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Buscar ou criar registro de afiliado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: affiliate } = await (admin as any)
    .from('affiliates')
    .select('id, code, total_earned, pending_payout, active_referrals, total_referrals, pix_key, pix_key_type')
    .eq('user_id', user.id)
    .single()

  if (!affiliate) {
    // Gerar código único baseado em parte do user.id
    const code = user.id.replace(/-/g, '').slice(0, 8).toUpperCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created } = await (admin as any)
      .from('affiliates')
      .insert({ user_id: user.id, code })
      .select()
      .single()
    affiliate = created
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: referrals } = await (admin as any)
    .from('affiliate_referrals')
    .select('status, plan, commission, created_at, activated_at')
    .eq('affiliate_id', affiliate?.id)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payouts } = await (admin as any)
    .from('affiliate_payouts')
    .select('amount, status, paid_at, created_at')
    .eq('affiliate_id', affiliate?.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://betcopiloto.com.br'
  const referralLink = `${appUrl}/register?ref=${affiliate?.code ?? ''}`

  const allReferrals = referrals ?? []
  const activeCount = allReferrals.filter((r: any) => r.status === 'active').length
  const totalEarned = affiliate?.total_earned ?? 0
  const pendingPayout = affiliate?.pending_payout ?? 0

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-5 pb-24">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Painel de Afiliado</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ganhe 30% de comissão por cada assinante que você indicar.</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Users className="h-3 w-3" /> Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Total ganho
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-xl font-bold">R$ {totalEarned.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> A receber
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-xl font-bold text-primary">R$ {pendingPayout.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Link de indicação */}
      <Card className="border-primary/20 bg-brand-muted">
        <CardContent className="py-4 px-4 space-y-2">
          <p className="text-xs font-semibold text-primary">Seu link de indicação</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-background/40 rounded px-2 py-1.5 truncate">
              {referralLink}
            </code>
            <AfiliadoCopyButton link={referralLink} />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Código: <span className="font-mono font-semibold">{affiliate?.code}</span> · Comissão: 30% recorrente · Pagamento todo dia 10 via Pix
          </p>
        </CardContent>
      </Card>

      {/* Saque */}
      <Card>
        <CardContent className="py-4 px-4">
          <SaqueForm
            pendingPayout={pendingPayout}
            pixKey={affiliate?.pix_key ?? null}
            pixKeyType={affiliate?.pix_key_type ?? null}
            activeReferrals={affiliate?.active_referrals ?? 0}
          />
        </CardContent>
      </Card>

      {/* Histórico de indicados */}
      {allReferrals.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold">Indicados ({allReferrals.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {allReferrals.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]',
                    r.status === 'active' ? 'bg-primary/20 text-primary' :
                    r.status === 'cancelled' ? 'bg-destructive/20 text-destructive' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {r.status === 'active' ? 'Ativo' : r.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <span className={cn('font-semibold', r.commission > 0 ? 'text-primary' : 'text-muted-foreground')}>
                  {r.commission > 0 ? `+R$ ${r.commission.toFixed(2)}` : '—'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Histórico de pagamentos */}
      {(payouts ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold">Pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {(payouts ?? []).map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]',
                    p.status === 'paid' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    {p.status === 'paid' ? 'Pago' : 'Pendente'}
                  </span>
                  <span className="text-muted-foreground">
                    {p.paid_at
                      ? new Date(p.paid_at).toLocaleDateString('pt-BR')
                      : new Date(p.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <span className="font-semibold text-primary">R$ {p.amount.toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {allReferrals.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <Users className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold">Nenhum indicado ainda</p>
            <p className="text-xs text-muted-foreground">Compartilhe seu link e ganhe 30% de cada assinatura.</p>
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-muted-foreground text-center pb-2">
        Saque disponível assim que você indicar o primeiro cliente. Pagamento via Pix.
      </p>
    </div>
  )
}
