'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, Clock, Trophy, Loader2 } from 'lucide-react'
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

export default function JogosPage() {
  const [days, setDays] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'ativos' | 'encerrados'>('ativos')

  useEffect(() => { fetchGames() }, [])

  async function fetchGames() {
    try {
      const res = await fetch('/api/jogos/hoje-completo')
      const json = await res.json()
      if (json.success) setDays(json.days)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }

  // Separa todos os jogos em ativos e encerrados
  const allGames = days.flatMap(d => d.games.map(g => ({ ...g, dayLabel: d.label, date: d.date })))
  const ativos = allGames.filter(g => !FINISHED_STATUS.includes(g.status))
  const encerrados = allGames.filter(g => FINISHED_STATUS.includes(g.status))

  // Agrupa por liga dentro de cada aba
  function groupByLeague(games: typeof allGames) {
    const map: Record<string, typeof allGames> = {}
    for (const g of games) {
      const key = `${g.country} — ${g.league}`
      if (!map[key]) map[key] = []
      map[key].push(g)
    }
    return map
  }

  const ativosGroup = groupByLeague(ativos)
  const encerradosGroup = groupByLeague(encerrados)
  const currentGroup = tab === 'ativos' ? ativosGroup : encerradosGroup
  const currentGames = tab === 'ativos' ? ativos : encerrados

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold">Jogos de hoje</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-1">
        <button
          onClick={() => setTab('ativos')}
          className={cn(
            'flex-1 py-2 text-xs font-medium rounded-lg transition-all border',
            tab === 'ativos'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:border-primary/30'
          )}
        >
          Em andamento / A jogar
          {ativos.length > 0 && (
            <span className={cn('ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full',
              tab === 'ativos' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {ativos.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('encerrados')}
          className={cn(
            'flex-1 py-2 text-xs font-medium rounded-lg transition-all border',
            tab === 'encerrados'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:border-primary/30'
          )}
        >
          Encerrados
          {encerrados.length > 0 && (
            <span className={cn('ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full',
              tab === 'encerrados' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {encerrados.length}
            </span>
          )}
        </button>
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

      {/* Lista por liga */}
      {Object.entries(currentGroup).map(([leagueKey, games]) => (
        <div key={leagueKey} className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <Trophy className="h-3 w-3 text-muted-foreground" />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{leagueKey}</p>
          </div>

          {games.map(g => {
            const isLive = LIVE_STATUS.includes(g.status)
            const isFinished = FINISHED_STATUS.includes(g.status)

            return (
              <Link
                key={g.fixture_id}
                href={`/jogos/${g.fixture_id}`}
                className={cn(
                  'block bg-card rounded-xl border p-4 transition-colors',
                  isFinished ? 'border-border opacity-70 hover:opacity-100 hover:border-primary/20' : 'border-border hover:border-primary/30'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm font-medium truncate',
                        isFinished && (g.home_goals ?? 0) > (g.away_goals ?? 0) && 'text-primary'
                      )}>
                        {g.home_team}
                      </span>
                      {(isLive || isFinished) && (
                        <span className={cn('text-lg font-bold tabular-nums shrink-0', isLive && 'text-primary')}>
                          {g.home_goals ?? 0}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm font-medium truncate',
                        isFinished && (g.away_goals ?? 0) > (g.home_goals ?? 0) && 'text-primary'
                      )}>
                        {g.away_team}
                      </span>
                      {(isLive || isFinished) && (
                        <span className={cn('text-lg font-bold tabular-nums shrink-0', isLive && 'text-primary')}>
                          {g.away_goals ?? 0}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1 shrink-0 w-16">
                    {isLive ? (
                      <span className="text-xs font-bold text-green-400 animate-pulse">
                        {g.elapsed ?? ''}′
                      </span>
                    ) : isFinished ? (
                      <span className="text-xs text-muted-foreground font-medium">FT</span>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {g.time}
                      </div>
                    )}
                    {g.has_analysis && (
                      <span className="text-[10px] bg-brand-muted text-primary px-1.5 py-0.5 rounded-full">IA</span>
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}
