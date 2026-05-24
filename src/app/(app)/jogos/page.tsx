'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown, Clock, Trophy, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const FINISHED_STATUS = ['FT', 'AET', 'PEN', 'ABD', 'WO', 'AWD']
const LIVE_STATUS = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']

interface Game {
  fixture_id: number
  home_team: string
  away_team: string
  league: string
  country: string
  time: string
  status: string
  home_goals?: number | null
  away_goals?: number | null
  elapsed?: number | null
  has_analysis?: boolean
}

interface Day {
  date: string
  label: string
  games: Game[]
}

const LEAGUE_ORDER = [
  'Champions League', 'Europa League', 'Conference League',
  'Premier League', 'La Liga', 'Serie A', 'Bundesliga',
  'Libertadores', 'Sul-Americana', 'Recopa Sudamericana',
  'Brasileirão Série A', 'Brasileirão Série B', 'Copa do Brasil',
  'Brasileirão Série C', 'Brasileirão Série D',
  'Liga Profesional',
]

function groupByLeague(games: Game[]) {
  const map: Record<string, { country: string; league: string; games: Game[] }> = {}
  for (const g of games) {
    const key = `${g.country}__${g.league}`
    if (!map[key]) map[key] = { country: g.country, league: g.league, games: [] }
    map[key].games.push(g)
  }
  return Object.values(map).sort((a, b) => {
    const ia = LEAGUE_ORDER.indexOf(a.league)
    const ib = LEAGUE_ORDER.indexOf(b.league)
    if (ia === -1 && ib === -1) return a.league.localeCompare(b.league)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

function LeagueAccordion({ country, league, games, defaultOpen }: {
  country: string
  league: string
  games: Game[]
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const liveCount = games.filter(g => LIVE_STATUS.includes(g.status)).length

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header clicável */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="text-left min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium truncate">{country}</p>
            <p className="text-sm font-semibold truncate">{league}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {liveCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-green-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {liveCount} ao vivo
            </span>
          )}
          <span className="text-xs text-muted-foreground">{games.length} jogos</span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {/* Jogos */}
      {open && (
        <div className="divide-y divide-border border-t border-border">
          {games.map(g => {
            const isLive = LIVE_STATUS.includes(g.status)
            const isFinished = FINISHED_STATUS.includes(g.status)

            return (
              <Link
                key={g.fixture_id}
                href={`/jogos/${g.fixture_id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-sm font-medium truncate',
                      isFinished && (g.home_goals ?? 0) > (g.away_goals ?? 0) ? 'text-primary' : ''
                    )}>
                      {g.home_team}
                    </span>
                    {(isLive || isFinished) && (
                      <span className={cn('text-base font-bold tabular-nums shrink-0', isLive ? 'text-green-400' : '')}>
                        {g.home_goals ?? 0}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-sm font-medium truncate',
                      isFinished && (g.away_goals ?? 0) > (g.home_goals ?? 0) ? 'text-primary' : ''
                    )}>
                      {g.away_team}
                    </span>
                    {(isLive || isFinished) && (
                      <span className={cn('text-base font-bold tabular-nums shrink-0', isLive ? 'text-green-400' : '')}>
                        {g.away_goals ?? 0}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 shrink-0 w-14 ml-3">
                  {isLive ? (
                    <span className="text-xs font-bold text-green-400 animate-pulse">{g.elapsed ?? ''}′</span>
                  ) : isFinished ? (
                    <span className="text-xs text-muted-foreground font-medium">FT</span>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {g.time}
                    </div>
                  )}
                  {g.has_analysis && (
                    <span className="text-[10px] bg-brand-muted text-primary px-1.5 py-0.5 rounded-full font-medium">IA</span>
                  )}
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function JogosPage() {
  const [days, setDays] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'ativos' | 'encerrados'>('ativos')

  const fetchGames = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await fetch('/api/jogos/hoje-completo', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setDays(json.days)
    } catch { /* silencioso */ } finally {
      setLoading(false)
      if (manual) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchGames()
    const interval = setInterval(() => fetchGames(), 60_000)
    return () => clearInterval(interval)
  }, [fetchGames])

  const allGames = days.flatMap(d => d.games)
  const ativos = allGames.filter(g => !FINISHED_STATUS.includes(g.status))
  const encerrados = allGames.filter(g => FINISHED_STATUS.includes(g.status))
  const currentGames = tab === 'ativos' ? ativos : encerrados
  const groups = groupByLeague(currentGames)

  // Abre por padrão apenas as ligas com jogos ao vivo
  const liveLeagues = new Set(
    ativos.filter(g => LIVE_STATUS.includes(g.status)).map(g => `${g.country}__${g.league}`)
  )

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="pt-2 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Jogos de hoje</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => fetchGames(true)}
          disabled={refreshing}
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1">
        {(['ativos', 'encerrados'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-xs font-medium rounded-lg transition-all border',
              tab === t
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/30'
            )}
          >
            {t === 'ativos' ? 'Em andamento / A jogar' : 'Encerrados'}
            {(t === 'ativos' ? ativos : encerrados).length > 0 && (
              <span className={cn('ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full',
                tab === t ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                {(t === 'ativos' ? ativos : encerrados).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Carregando jogos...</span>
        </div>
      )}

      {!loading && currentGames.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-semibold">
            {tab === 'ativos' ? 'Nenhum jogo ativo' : 'Nenhum jogo encerrado ainda'}
          </p>
          <p className="text-sm text-muted-foreground">
            {tab === 'ativos' ? 'Sem jogos em andamento ou agendados hoje.' : 'Os jogos encerrados aparecerão aqui.'}
          </p>
        </div>
      )}

      {/* Accordions por liga */}
      <div className="space-y-2">
        {groups.map(({ country, league, games }) => (
          <LeagueAccordion
            key={`${country}__${league}`}
            country={country}
            league={league}
            games={games}
            defaultOpen={liveLeagues.has(`${country}__${league}`) || liveLeagues.size === 0}
          />
        ))}
      </div>
    </div>
  )
}
