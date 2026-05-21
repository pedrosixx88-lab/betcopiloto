'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Ticket, Loader2, AlertTriangle, TrendingUp,
  CheckCircle2, ChevronRight, Trophy, X
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Fixture {
  fixture_id: number
  home_team: string
  away_team: string
  league: string
  summary: {
    tip: string
    confidence: 'alta' | 'média' | 'baixa'
  }
}

interface TicketSelection {
  fixture_id: number
  home_team: string
  away_team: string
  market: string
  selection: string
  reasoning: string
}

interface Ticket {
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

const CONFIDENCE_COLOR = {
  alta: 'text-primary border-primary/30 bg-brand-muted',
  média: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  baixa: 'text-muted-foreground border-border bg-muted/30',
}

export default function BilhetePage() {
  const [analysed, setAnalysed] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [stake, setStake] = useState('50')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [building, setBuilding] = useState(false)

  useEffect(() => { fetchAnalysed() }, [])

  async function fetchAnalysed() {
    try {
      const res = await fetch('/api/jogos/analisados')
      const json = await res.json()
      if (json.success) setAnalysed(json.games)
    } catch {
      toast.error('Erro ao carregar jogos analisados')
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

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold">Montador de bilhete</h1>
        <p className="text-sm text-muted-foreground mt-0.5">IA monta o bilhete com base no seu histórico</p>
      </div>

      {/* Jogos analisados */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Selecione os jogos
        </p>

        {loading && (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Carregando jogos...</span>
          </div>
        )}

        {!loading && analysed.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center space-y-3">
              <Trophy className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">Nenhum jogo analisado ainda</p>
              <p className="text-xs text-muted-foreground">
                Acesse a aba Jogos, abra um jogo e a análise é gerada automaticamente.
              </p>
              <Link href="/jogos" className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                Ver jogos do dia <ChevronRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        )}

        {analysed.map(g => {
          const isSelected = selected.has(g.fixture_id)
          const conf = g.summary?.confidence as keyof typeof CONFIDENCE_COLOR | undefined
          return (
            <button
              key={g.fixture_id}
              onClick={() => toggleGame(g.fixture_id)}
              className={cn(
                'w-full text-left bg-card rounded-xl border p-4 transition-all',
                isSelected ? 'border-primary bg-brand-muted' : 'border-border hover:border-primary/30'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {g.home_team} <span className="text-muted-foreground font-normal">vs</span> {g.away_team}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{g.league}</span>
                    {g.summary?.tip && (
                      <span className="text-xs text-primary truncate">→ {g.summary.tip}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {conf && (
                    <Badge className={cn('text-[10px] border', CONFIDENCE_COLOR[conf])}>
                      {conf}
                    </Badge>
                  )}
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                    isSelected ? 'border-primary bg-primary' : 'border-border'
                  )}>
                    {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Configuração */}
      {analysed.length > 0 && (
        <Card>
          <CardContent className="py-4 px-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Jogos selecionados</span>
              <span className="font-semibold">{selected.size} / 6</span>
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

            <Button
              className="w-full gap-2"
              onClick={buildTicket}
              disabled={building || selected.size === 0}
            >
              {building
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Montando bilhete...</>
                : <><Ticket className="h-4 w-4" /> Montar bilhete com IA</>
              }
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {ticket && (
        <div className="space-y-3">
          {/* Alertas */}
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

          {/* Seleções */}
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

          {/* Resumo financeiro */}
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

          {/* Resetar */}
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
