'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Ticket, Loader2, AlertTriangle, TrendingUp,
  CheckCircle2, Trophy, X, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Game {
  fixture_id: number
  home_team: string
  away_team: string
  league: string
  time: string
  status: string
}

interface TicketSelection {
  fixture_id: number
  home_team: string
  away_team: string
  market: string
  selection: string
  reasoning: string
}

interface TicketResult {
  selections: TicketSelection[]
  stake_suggested: number
  potential_return: number
  estimated_odd: number
  confidence: string
  alerts: string[]
}

const MARKET_LABELS: Record<string, string> = {
  match_winner: '1X2',
  over_under: 'Mais/Menos',
  both_teams_score: 'Ambas marcam',
  handicap: 'Handicap',
  correct_score: 'Placar exato',
  other: 'Outro',
}

export default function BilhetePage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [stake, setStake] = useState('50')
  const [ticket, setTicket] = useState<TicketResult | null>(null)
  const [building, setBuilding] = useState(false)

  useEffect(() => { fetchGames() }, [])

  async function fetchGames() {
    try {
      const res = await fetch('/api/jogos/hoje')
      const json = await res.json()
      if (json.success) setGames(json.games)
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
      else if (next.size < 6) next.add(id)
      else toast.warning('Máximo 6 jogos por bilhete')
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
      // Primeiro garante que todos os jogos selecionados têm análise
      await Promise.all(
        Array.from(selected).map(id => fetch(`/api/jogos/${id}/analisar`))
      )

      const res = await fetch('/api/bilhete/montar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stake: stakeNum, fixture_ids: Array.from(selected) }),
      })
      const json = await res.json()
      if (json.success) setTicket(json.ticket)
      else toast.error(json.error ?? 'Erro ao montar bilhete')
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setBuilding(false)
    }
  }

  // Agrupa por liga
  const byLeague: Record<string, Game[]> = {}
  for (const g of games) {
    if (!byLeague[g.league]) byLeague[g.league] = []
    byLeague[g.league].push(g)
  }

  return (
    <div className="p-4 space-y-5 pb-24">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold">Montador de bilhete</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Selecione os jogos e a IA monta para você</p>
      </div>

      {/* Jogos do dia */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Carregando jogos do dia...</span>
        </div>
      )}

      {!loading && games.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">Nenhum jogo hoje</p>
            <p className="text-xs text-muted-foreground">Sem jogos nas ligas monitoradas.</p>
          </CardContent>
        </Card>
      )}

      {Object.entries(byLeague).map(([league, leagueGames]) => (
        <div key={league} className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{league}</p>
          </div>

          {leagueGames.map(g => {
            const isSelected = selected.has(g.fixture_id)
            const isFinished = g.status === 'FT'
            return (
              <button
                key={g.fixture_id}
                onClick={() => !isFinished && toggleGame(g.fixture_id)}
                disabled={isFinished}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-all',
                  isFinished && 'opacity-40 cursor-not-allowed border-border bg-card',
                  !isFinished && isSelected && 'border-primary bg-brand-muted',
                  !isFinished && !isSelected && 'bg-card border-border hover:border-primary/30'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {g.home_team} <span className="text-muted-foreground font-normal">vs</span> {g.away_team}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{isFinished ? 'Encerrado' : g.time}</span>
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

      {/* Configuração e botão */}
      {games.length > 0 && !loading && (
        <Card>
          <CardContent className="py-4 px-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Jogos selecionados</span>
              <span className="font-semibold text-primary">{selected.size} / 6</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Valor disponível (R$)</label>
              <input
                type="number"
                min="1"
                value={stake}
                onChange={e => { setStake(e.target.value); setTicket(null) }}
                placeholder="50.00"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
              />
            </div>
            <Button className="w-full gap-2" onClick={buildTicket} disabled={building || selected.size === 0}>
              {building
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando e montando bilhete...</>
                : <><Ticket className="h-4 w-4" /> Montar bilhete com IA</>
              }
            </Button>
            {building && (
              <p className="text-xs text-center text-muted-foreground">
                A IA está analisando os jogos selecionados...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {ticket && (
        <div className="space-y-3">
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
                <TrendingUp className="h-4 w-4 text-primary" />
                Bilhete sugerido
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-4">
              {ticket.selections.map((s, i) => (
                <div key={i} className="space-y-1 pb-3 border-b border-border last:border-0 last:pb-0">
                  <p className="text-xs text-muted-foreground">{s.home_team} vs {s.away_team}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-md shrink-0">
                      {MARKET_LABELS[s.market] ?? s.market}
                    </span>
                    <span className="text-sm font-semibold">{s.selection}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.reasoning}</p>
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
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Odd total estimada</span>
                <span className="font-semibold">{ticket.estimated_odd?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-primary/20 pt-2">
                <span className="text-muted-foreground">Retorno potencial</span>
                <span className="font-bold text-primary">R$ {ticket.potential_return?.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-primary font-medium">Confiança {ticket.confidence}</span>
              </div>
            </CardContent>
          </Card>

          <button
            onClick={() => { setTicket(null); setSelected(new Set()) }}
            className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <X className="h-3.5 w-3.5" /> Limpar e montar outro
          </button>
        </div>
      )}
    </div>
  )
}
