import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlusCircle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BetMarket, BetStatus } from '@/types/database'
import { MARKET_LABELS_SHORT } from '@/lib/labels'

const STATUS_CONFIG: Record<BetStatus, { label: string; class: string }> = {
  pending: { label: 'Pendente',  class: 'bg-muted text-muted-foreground' },
  won:     { label: 'Green ✓',  class: 'bg-brand-muted text-primary border-primary/30' },
  lost:    { label: 'Red ✗',    class: 'bg-destructive/10 text-destructive border-destructive/30' },
  void:    { label: 'Anulada',  class: 'bg-muted text-muted-foreground' },
}

export default async function ApostasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { status } = await searchParams

  let query = supabase
    .from('bets')
    .select('id, home_team, away_team, league, market, selection, odd, stake, potential_return, status, match_date, bookmaker')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status && ['pending', 'won', 'lost', 'void'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data: bets } = await query.returns<Array<{
    id: string
    home_team: string
    away_team: string
    league: string | null
    market: BetMarket
    selection: string
    odd: number
    stake: number
    potential_return: number
    status: BetStatus
    match_date: string
    bookmaker: string | null
  }>>()

  const filters: Array<{ value: string; label: string }> = [
    { value: '', label: 'Todas' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'won', label: 'Green' },
    { value: 'lost', label: 'Red' },
  ]

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Minhas apostas</h1>
        <Link href="/apostas/nova" className={buttonVariants({ size: 'sm' })}>
          <PlusCircle className="h-4 w-4 mr-1" /> Nova
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map(f => (
          <Link
            key={f.value}
            href={f.value ? `/apostas?status=${f.value}` : '/apostas'}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border',
              (status ?? '') === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Lista */}
      {!bets || bets.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-semibold">Nenhuma aposta aqui</p>
          <p className="text-sm text-muted-foreground">
            {status ? 'Nenhuma aposta com este filtro.' : 'Registre sua primeira aposta.'}
          </p>
          {!status && (
            <Link href="/apostas/nova" className={buttonVariants({ size: 'sm' })}>
              Registrar aposta
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3 pb-6">
          {bets.map(bet => {
            const statusCfg = STATUS_CONFIG[bet.status]
            const profit = bet.status === 'won'
              ? bet.potential_return - bet.stake
              : bet.status === 'lost'
              ? -bet.stake
              : null

            return (
              <Link key={bet.id} href={`/apostas/${bet.id}`} className="block bg-card rounded-xl border border-border p-4 space-y-3 hover:border-primary/40 transition-colors">
                {/* Times + status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm leading-tight">
                      {bet.home_team} <span className="text-muted-foreground font-normal">vs</span> {bet.away_team}
                    </p>
                    {bet.league && (
                      <p className="text-xs text-muted-foreground mt-0.5">{bet.league}</p>
                    )}
                  </div>
                  <Badge className={cn('text-xs shrink-0 border', statusCfg.class)}>
                    {statusCfg.label}
                  </Badge>
                </div>

                {/* Detalhes */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="bg-secondary px-2 py-0.5 rounded-md">
                    {MARKET_LABELS_SHORT[bet.market] ?? bet.market}
                  </span>
                  <span>{bet.selection}</span>
                </div>

                {/* Valores */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      R$ {bet.stake.toFixed(2)} <span className="text-primary font-medium">@ {bet.odd}</span>
                    </span>
                  </div>
                  <div className="text-right">
                    {profit !== null ? (
                      <span className={cn('font-bold', profit >= 0 ? 'text-primary' : 'text-destructive')}>
                        {profit >= 0 ? '+' : ''}R$ {profit.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Retorno: R$ {bet.potential_return.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Data + casa */}
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
                  <span>{new Date(bet.match_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  {bet.bookmaker && <span>{bet.bookmaker}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
