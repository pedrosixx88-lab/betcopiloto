'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Ticket, Loader2, AlertTriangle, TrendingUp,
  CheckCircle2, Trophy, X, Clock, Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MARKET_LABELS_SHORT as MARKET_LABELS_MAP, translateSelection } from '@/lib/labels'

interface Game {
  fixture_id: number
  home_team: string
  away_team: string
  league: string
  country: string
  time: string
  status: string
}

interface Day {
  date: string
  label: string
  games: Game[]
}

interface TicketSelection {
  fixture_id: number
  home_team: string
  away_team: string
  market: string
  selection: string
  reasoning: string
  odd?: string | null
}

interface TicketResult {
  selections: TicketSelection[]
  stake_suggested: number
  confidence: string
  alerts: string[]
}

export default function BilheteClient() {
  const [days, setDays] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [stake, setStake] = useState('50')
  const [ticket, setTicket] = useState<TicketResult | null>(null)
  const [building, setBuilding] = useState(false)

  useEffect(() => { fetchGames() }, [])

  useEffect(() => {
    if (ticket) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [ticket])

  async function fetchGames() {
    try {
      const res = await fetch('/api/jogos/hoje')
      const json = await res.json()
      if (json.success) setDays(json.days)
    } catch {
      toast.error('Erro ao carregar jogos')
    } finally {
      setLoading(false)
    }
  }

  function toggleGame(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 8) next.add(id)
      else toast.warning('Máximo 8 jogos por bilhete')
      return next
    })
    setTicket(null)
  }

  async function buildTicket() {
    if (selected.size === 0) { toast.error('Selecione pelo menos 1 jogo'); return }
    const stakeNum = parseFloat(stake)
    if (!stakeNum || stakeNum <= 0) { toast.error('Informe um valor válido'); return }

    setBuilding(true)
    try {
      const res = await fetch('/api/bilhete/montar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stake: stakeNum, fixture_ids: Array.from(selected) }),
      })
      const json = await res.json()
      if (json.success) setTicket(json.ticket)
      else if (json.error === 'upgrade_required') toast.error('Assine o Pro para usar o montador de bilhete.')
      else toast.error(json.error ?? 'Erro ao montar bilhete')
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setBuilding(false)
    }
  }

  const totalGames = days.reduce((acc, d) => acc + d.games.length, 0)

  if (ticket) {
    return (
      <div className="p-4 space-y-4 pb-24">
        <div className="pt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Bilhete montado</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{ticket.selections.length} seleção{ticket.selections.length > 1 ? 'ões' : ''}</p>
          </div>
          <button
            onClick={() => { setTicket(null); setSelected(new Set()) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-2"
          >
            <X className="h-3.5 w-3.5" /> Novo bilhete
          </button>
        </div>

        {ticket.alerts?.length > 0 && (
          <Card className="border-yellow-400/20 bg-yellow-400/5">
            <CardContent className="py-3 px-4 space-y-1.5">
              {ticket.alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">{a}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Seleções
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-4">
            {ticket.selections.map((s, i) => (
              <div key={i} className="space-y-1 pb-3 border-b border-border last:border-0 last:pb-0">
                <p className="text-xs text-muted-foreground">{s.home_team} vs {s.away_team}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded-md shrink-0">
                    {MARKET_LABELS_MAP[s.market] ?? s.market}
                  </span>
                  <span className="text-sm font-semibold flex-1">{translateSelection(s.selection)}</span>
                  {s.odd && (
                    <span className="text-xs font-bold text-primary bg-brand-muted border border-primary/20 px-1.5 py-0.5 rounded shrink-0">
                      {s.odd}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{s.reasoning}</p>
                {s.odd && (
                  <p className="text-[10px] text-yellow-400/70">⚠ Odd registrada no momento da análise — verifique na Bet365</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-brand-muted">
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stake sugerido</span>
              <span className="font-semibold">R$ {ticket.stake_suggested?.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-primary/20">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-primary font-medium">Confiança {ticket.confidence}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Consulte as odds reais na sua casa de apostas antes de apostar.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5 pb-24">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Montador de bilhete</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Selecione os jogos e a IA monta para você
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Carregando jogos...</span>
        </div>
      )}

      {!loading && totalGames === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">Nenhum jogo disponível</p>
            <p className="text-xs text-muted-foreground">Sem jogos nos próximos dias.</p>
          </CardContent>
        </Card>
      )}

      {selected.size > 0 && !ticket && (
        <Card className="border-primary/30 bg-brand-muted sticky top-16 z-10">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">{selected.size} jogo{selected.size > 1 ? 's' : ''} selecionado{selected.size > 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">Máximo 8 jogos</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={stake}
                onChange={e => setStake(e.target.value)}
                placeholder="R$ 50"
                className="w-24 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50"
              />
              <Button size="sm" onClick={buildTicket} disabled={building} className="gap-1.5">
                {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ticket className="h-3.5 w-3.5" />}
                {building ? 'Montando...' : 'Montar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {days.map(day => {
        const byLeague: Record<string, Game[]> = {}
        for (const g of day.games) {
          const key = `${g.country} — ${g.league}`
          if (!byLeague[key]) byLeague[key] = []
          byLeague[key].push(g)
        }

        return (
          <div key={day.date} className="space-y-3">
            <div className="flex items-center gap-2 pt-1">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold capitalize">{day.label}</h2>
              <span className="text-xs text-muted-foreground">({day.games.length} jogos)</span>
            </div>

            {Object.entries(byLeague).map(([leagueKey, leagueGames]) => (
              <div key={leagueKey} className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-1">
                  <Trophy className="h-3 w-3 text-muted-foreground" />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{leagueKey}</p>
                </div>

                {leagueGames.map(g => {
                  const isSelected = selected.has(g.fixture_id)
                  const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(g.status)
                  return (
                    <button
                      key={g.fixture_id}
                      onClick={() => toggleGame(g.fixture_id)}
                      className={cn(
                        'w-full text-left rounded-xl border p-3 transition-all',
                        isSelected ? 'border-primary bg-brand-muted' : 'bg-card border-border hover:border-primary/30'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {g.home_team} <span className="text-muted-foreground font-normal">vs</span> {g.away_team}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                            {isLive
                              ? <span className="text-green-400 font-semibold animate-pulse">● Ao vivo</span>
                              : <><Clock className="h-3 w-3" /><span>{g.time}</span></>
                            }
                          </div>
                        </div>
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                          isSelected ? 'border-primary bg-primary' : 'border-border'
                        )}>
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
