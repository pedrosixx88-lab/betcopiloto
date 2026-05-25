'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, RefreshCw, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

interface BetLeg {
  home_team: string
  away_team: string
  selection: string
  odd: number
  market: string
}

interface Bet {
  id: string
  home_team: string
  away_team: string
  league: string | null
  market: string
  selection: string
  odd: number
  stake: number
  potential_return: number
  status: 'pending' | 'won' | 'lost' | 'void'
  match_date: string
  bookmaker: string | null
  is_multiple: boolean
  legs: BetLeg[] | null
  screenshot_url: string | null
}

interface LiveGame {
  fixture_id: number
  home_team: string
  away_team: string
  league: string
  status: string
  home_goals: number | null
  away_goals: number | null
  elapsed: number | null
  time: string
}

const FINISHED_STATUS = ['FT', 'AET', 'PEN', 'ABD', 'WO', 'AWD']
const LIVE_STATUS = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/\b(cf|fc|sc|ac|as|ss|rc|cd|sd|ud|rcd|ssd|afc|bfc|fk|sk|if|bk|vv|sv|sv|de|da|do|dos|del|di|el|la|le|los|las)\b/g, '') // remove prefixos/sufixos comuns
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchTeam(betTeam: string, gameTeam: string) {
  const a = normalize(betTeam)
  const b = normalize(gameTeam)
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  // Match por palavras significativas (≥4 chars)
  const wordsA = a.split(' ').filter(w => w.length >= 4)
  const wordsB = b.split(' ').filter(w => w.length >= 4)
  return wordsA.some(w => wordsB.includes(w))
}

function findGameForLeg(leg: BetLeg, games: LiveGame[]) {
  return games.find(g => {
    const homeMatch = matchTeam(leg.home_team, g.home_team) || matchTeam(leg.home_team, g.away_team)
    const awayMatch = matchTeam(leg.away_team, g.home_team) || matchTeam(leg.away_team, g.away_team)
    return homeMatch && awayMatch
  }) ?? null
}

function legResult(leg: BetLeg, game: LiveGame | null): 'pending' | 'won' | 'lost' | 'live' {
  if (!game) return 'pending'
  if (LIVE_STATUS.includes(game.status)) return 'live'
  if (!FINISHED_STATUS.includes(game.status)) return 'pending'

  const sel = normalize(leg.selection)
  const h = game.home_goals ?? 0
  const a = game.away_goals ?? 0

  // Ambas marcam - Sim
  if (sel.includes('ambas') || sel.includes('both') || sel.includes('btts')) {
    return h > 0 && a > 0 ? 'won' : 'lost'
  }
  // Resultado final
  if (sel.includes(normalize(game.home_team)) || sel.includes('1') && !sel.includes('over')) {
    return h > a ? 'won' : 'lost'
  }
  if (sel.includes(normalize(game.away_team)) || sel.includes('2') && !sel.includes('over')) {
    return a > h ? 'won' : 'lost'
  }
  if (sel.includes('empate') || sel.includes('draw') || sel === 'x') {
    return h === a ? 'won' : 'lost'
  }
  return 'pending'
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    pending: { label: 'Pendente', class: 'bg-muted text-muted-foreground' },
    won:     { label: 'Green ✓',  class: 'bg-brand-muted text-primary border-primary/30' },
    lost:    { label: 'Red ✗',    class: 'bg-destructive/10 text-destructive border-destructive/30' },
    void:    { label: 'Anulada',  class: 'bg-muted text-muted-foreground' },
  }
  const c = cfg[status as keyof typeof cfg] ?? cfg.pending
  return <Badge className={cn('text-xs shrink-0 border', c.class)}>{c.label}</Badge>
}

export default function ApostaDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [bet, setBet] = useState<Bet | null>(null)
  const [games, setGames] = useState<LiveGame[]>([])
  const [tab, setTab] = useState<'resumo' | 'acompanhar'>('resumo')
  const [loadingGames, setLoadingGames] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [resolvendo, setResolvendo] = useState(false)

  async function marcarResultado(status: 'won' | 'lost' | 'void') {
    if (!bet || resolvendo) return
    setResolvendo(true)
    try {
      const res = await fetch(`/api/apostas/${bet.id}/resultado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setBet(prev => prev ? { ...prev, status } : prev)
      }
    } finally {
      setResolvendo(false)
    }
  }

  useEffect(() => {
    async function loadBet() {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('bets')
        .select('id, home_team, away_team, league, market, selection, odd, stake, potential_return, status, match_date, bookmaker, is_multiple, legs, screenshot_url')
        .eq('id', id)
        .single()
      if (data) setBet(data)
    }
    loadBet()
  }, [id])

  const fetchGames = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    else setLoadingGames(true)
    try {
      const res = await fetch('/api/jogos/hoje-completo', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) {
        const allGames = json.days.flatMap((d: { games: LiveGame[] }) => d.games)
        setGames(allGames)
      }
    } finally {
      setLoadingGames(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'acompanhar') fetchGames()
  }, [tab, fetchGames])

  // Auto-refresh a cada 60s quando na aba acompanhar
  useEffect(() => {
    if (tab !== 'acompanhar') return
    const interval = setInterval(() => fetchGames(), 60000)
    return () => clearInterval(interval)
  }, [tab, fetchGames])

  if (!bet) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const legs: BetLeg[] = bet.is_multiple && bet.legs
    ? bet.legs
    : [{ home_team: bet.home_team, away_team: bet.away_team, selection: bet.selection, odd: bet.odd, market: bet.market }]

  const profit = bet.status === 'won'
    ? bet.potential_return - bet.stake
    : bet.status === 'lost'
    ? -bet.stake
    : null

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold truncate">
            {bet.home_team} <span className="text-muted-foreground font-normal">vs</span> {bet.away_team}
          </h1>
          {bet.is_multiple && (
            <p className="text-xs text-primary font-medium">Bilhete múltiplo · {legs.length} jogos</p>
          )}
        </div>
        <StatusBadge status={bet.status} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {(['resumo', 'acompanhar'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {t === 'resumo' ? 'Resumo' : '⚡ Ao vivo'}
          </button>
        ))}
      </div>

      {/* Tab: Resumo */}
      {tab === 'resumo' && (
        <div className="space-y-4">
          {/* Card de valores */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Apostado</p>
                <p className="font-bold">R$ {bet.stake.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Odd total</p>
                <p className="font-bold text-primary">{bet.odd}x</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {profit !== null ? 'Resultado' : 'Retorno pot.'}
                </p>
                <p className={cn('font-bold', profit !== null ? (profit >= 0 ? 'text-primary' : 'text-destructive') : '')}>
                  {profit !== null
                    ? `${profit >= 0 ? '+' : ''}R$ ${profit.toFixed(2)}`
                    : `R$ ${bet.potential_return.toFixed(2)}`}
                </p>
              </div>
            </div>
            <div className="border-t border-border pt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(bet.match_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              {bet.bookmaker && <span>{bet.bookmaker}</span>}
            </div>
          </div>

          {/* Marcar resultado — só aparece se pendente */}
          {bet.status === 'pending' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resultado</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => marcarResultado('won')}
                  disabled={resolvendo}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 border border-primary/30 text-primary font-semibold text-sm hover:bg-primary/20 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Green ✓
                </button>
                <button
                  onClick={() => marcarResultado('lost')}
                  disabled={resolvendo}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive font-semibold text-sm hover:bg-destructive/20 transition-all disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Red ✗
                </button>
              </div>
            </div>
          )}

          {/* Jogos do bilhete */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {bet.is_multiple ? `${legs.length} jogos` : 'Jogo'}
            </p>
            {legs.map((leg, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-3 space-y-1">
                <p className="font-medium text-sm">{leg.home_team} <span className="text-muted-foreground">x</span> {leg.away_team}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{leg.selection}</span>
                  <span className="text-primary font-medium">{leg.odd}x</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Acompanhar */}
      {tab === 'acompanhar' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Atualiza automaticamente</p>
            <button
              onClick={() => fetchGames(true)}
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {loadingGames ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {legs.map((leg, i) => {
                const game = findGameForLeg(leg, games)
                const result = legResult(leg, game)
                const isLive = game && LIVE_STATUS.includes(game.status)
                const isFinished = game && FINISHED_STATUS.includes(game.status)

                return (
                  <div key={i} className={cn(
                    'bg-card rounded-xl border p-4 space-y-3 transition-all',
                    result === 'won' ? 'border-primary/40 bg-brand-muted/30' :
                    result === 'lost' ? 'border-destructive/40 bg-destructive/5' :
                    result === 'live' ? 'border-yellow-500/40' :
                    'border-border'
                  )}>
                    {/* Header do jogo */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-medium">{game?.league ?? 'Aguardando...'}</p>
                      <div className="flex items-center gap-1.5">
                        {isLive && (
                          <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                            {game.elapsed}'
                          </span>
                        )}
                        {!isLive && game?.time && !isFinished && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> {game.time}
                          </span>
                        )}
                        {isFinished && (
                          <span className="text-xs text-muted-foreground">Encerrado</span>
                        )}
                        {!game && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> Não encontrado hoje
                          </span>
                        )}
                        {result === 'won' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        {result === 'lost' && <XCircle className="h-4 w-4 text-destructive" />}
                      </div>
                    </div>

                    {/* Placar */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className={cn('font-semibold text-sm', game && game.home_goals! > game.away_goals! && isFinished ? 'text-primary' : '')}>{leg.home_team}</p>
                      </div>
                      <div className="px-4 text-center">
                        {game ? (
                          <span className={cn('text-2xl font-bold tabular-nums', isLive ? 'text-yellow-400' : '')}>
                            {game.home_goals ?? 0} — {game.away_goals ?? 0}
                          </span>
                        ) : (
                          <span className="text-lg text-muted-foreground font-bold">– –</span>
                        )}
                      </div>
                      <div className="flex-1 text-right">
                        <p className={cn('font-semibold text-sm', game && game.away_goals! > game.home_goals! && isFinished ? 'text-primary' : '')}>{leg.away_team}</p>
                      </div>
                    </div>

                    {/* Seleção apostada */}
                    <div className={cn(
                      'rounded-lg px-3 py-2 text-xs flex items-center justify-between',
                      result === 'won' ? 'bg-primary/10 text-primary' :
                      result === 'lost' ? 'bg-destructive/10 text-destructive' :
                      'bg-secondary text-muted-foreground'
                    )}>
                      <span>Aposta: <span className="font-medium">{leg.selection}</span></span>
                      <span className="font-bold">{leg.odd}x</span>
                    </div>
                  </div>
                )
              })}

              {/* Resultado geral da múltipla */}
              {bet.is_multiple && legs.length > 1 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Resultado da múltipla</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {legs.map((leg, i) => {
                          const g = findGameForLeg(leg, games)
                          const r = legResult(leg, g)
                          return r === 'won' ? '✓' : r === 'lost' ? '✗' : r === 'live' ? '⚡' : '⏳'
                        }).join(' ')} · {legs.filter((leg, i) => legResult(leg, findGameForLeg(leg, games)) === 'won').length}/{legs.length} ganhos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Retorno potencial</p>
                      <p className="font-bold text-primary">R$ {bet.potential_return.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
