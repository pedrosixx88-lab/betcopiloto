import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Target, PlusCircle, ListFilter, Brain } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { BankrollChart } from '@/components/dashboard/bankroll-chart'
import BriefingCard from '@/components/dashboard/briefing-card'
import { BancaCard } from '@/components/dashboard/banca-card'
import { cn } from '@/lib/utils'

function getDateBRT(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, current_bankroll, initial_bankroll, onboarding_completed')
    .eq('id', user.id)
    .single<{ name: string | null; current_bankroll: number; initial_bankroll: number; onboarding_completed: boolean }>()

  if (!profile?.onboarding_completed) redirect('/onboarding')

  // Buscar briefing do dia
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: briefing } = await (admin as any)
    .from('daily_briefings')
    .select('content, games_count, created_at')
    .eq('date', getDateBRT())
    .single()

  const { data: bets } = await supabase
    .from('bets')
    .select('status, stake, potential_return, market, league, match_date, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .returns<Array<{
      status: string
      stake: number
      potential_return: number
      market: string
      league: string | null
      match_date: string
      created_at: string
    }>>()

  const allBets = bets ?? []
  const totalBets = allBets.length
  const wonBets = allBets.filter(b => b.status === 'won').length
  const lostBets = allBets.filter(b => b.status === 'lost').length
  const pendingBets = allBets.filter(b => b.status === 'pending').length
  const settledBets = wonBets + lostBets
  const winRate = settledBets > 0 ? ((wonBets / settledBets) * 100).toFixed(1) : null

  const profit = allBets.reduce((acc, bet) => {
    if (bet.status === 'won') return acc + (bet.potential_return - bet.stake)
    if (bet.status === 'lost') return acc - bet.stake
    return acc
  }, 0)

  const totalStaked = allBets.filter(b => b.status !== 'pending').reduce((acc, b) => acc + b.stake, 0)
  const roi = totalStaked > 0 ? ((profit / totalStaked) * 100).toFixed(1) : null

  // Gráfico de evolução da banca
  const initial = profile?.initial_bankroll ?? 0
  let running = initial
  const chartData = allBets
    .filter(b => b.status !== 'pending')
    .map(b => {
      if (b.status === 'won') running += b.potential_return - b.stake
      if (b.status === 'lost') running -= b.stake
      return {
        date: new Date(b.match_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        banca: parseFloat(running.toFixed(2)),
      }
    })

  // Breakdown por mercado
  const byMarket: Record<string, { won: number; total: number }> = {}
  allBets.filter(b => b.status !== 'pending').forEach(b => {
    if (!byMarket[b.market]) byMarket[b.market] = { won: 0, total: 0 }
    byMarket[b.market].total++
    if (b.status === 'won') byMarket[b.market].won++
  })

  const { MARKET_LABELS_SHORT: MARKET_LABELS } = await import('@/lib/labels')

  const marketStats = Object.entries(byMarket)
    .map(([market, s]) => ({ market, label: MARKET_LABELS[market] ?? market, winRate: ((s.won / s.total) * 100).toFixed(0), total: s.total }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pt-2">
        <div>
          <h1 className="text-xl font-bold">Olá, {profile?.name?.split(' ')[0] ?? 'apostador'} 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Sua performance</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/apostas" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ListFilter className="h-4 w-4 mr-1" /> Apostas
          </Link>
          <Link href="/apostas/nova" className={buttonVariants({ size: 'sm' })}>
            <PlusCircle className="h-4 w-4 mr-1" /> Registrar
          </Link>
        </div>
      </div>

      {/* Cards de métricas — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BancaCard initialValue={profile?.current_bankroll ?? 0} />

        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              {profit >= 0
                ? <TrendingUp className="h-3 w-3 text-primary" />
                : <TrendingDown className="h-3 w-3 text-destructive" />}
              Lucro/Prejuízo
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className={cn('text-2xl font-bold', profit >= 0 ? 'text-primary' : 'text-destructive')}>
              {profit >= 0 ? '+' : ''}R$ {profit.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Target className="h-3 w-3" /> Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold">{winRate ? `${winRate}%` : '—'}</p>
            <p className="text-xs text-muted-foreground">{settledBets} res. · {pendingBets} pend.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium">ROI</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className={cn('text-2xl font-bold',
              roi ? (parseFloat(roi) >= 0 ? 'text-primary' : 'text-destructive') : ''
            )}>
              {roi ? `${roi}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">{totalBets} apostas total</p>
          </CardContent>
        </Card>
      </div>

      {/* Briefing + gráfico/mercado lado a lado no desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <BriefingCard initial={briefing ?? null} />

        <div className="space-y-5">
          {chartData.length >= 2 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold">Evolução da banca</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                <BankrollChart data={chartData} initialBankroll={initial} />
              </CardContent>
            </Card>
          )}

          {marketStats.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold">Performance por mercado</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {marketStats.map(m => (
                  <div key={m.market} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{m.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{m.total} apostas</span>
                      <span className={cn('font-semibold text-xs', parseFloat(m.winRate) >= 50 ? 'text-primary' : 'text-destructive')}>
                        {m.winRate}% win
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {totalBets === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center space-y-3">
                <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto" />
                <h3 className="font-semibold">Nenhuma aposta ainda</h3>
                <p className="text-sm text-muted-foreground">Registre sua primeira aposta para ver sua performance.</p>
                <Link href="/apostas/nova" className={buttonVariants({ size: 'sm' })}>
                  <PlusCircle className="h-4 w-4 mr-1" /> Registrar aposta
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dica IA — só aparece com dados suficientes */}
      {settledBets >= 3 && (
        <Card className="border-primary/20 bg-brand-muted">
          <CardContent className="py-3 px-4 flex items-start gap-3">
            <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-primary">Análise IA</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {winRate && parseFloat(winRate) >= 55
                  ? `Seu win rate de ${winRate}% está acima da média. Continue no mercado ${marketStats[0]?.label ?? ''}.`
                  : `Seu win rate atual é ${winRate ?? 0}%. Análise detalhada disponível no Milestone 4.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
