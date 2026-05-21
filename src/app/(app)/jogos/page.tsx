import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getFixturesByDate, FEATURED_LEAGUES } from '@/lib/api-football'
import { ChevronRight, Clock, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

function statusLabel(short: string) {
  if (['NS', 'TBD'].includes(short)) return { text: 'Em breve', cls: 'text-muted-foreground' }
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return { text: 'Ao vivo', cls: 'text-green-400' }
  if (short === 'FT') return { text: 'Encerrado', cls: 'text-muted-foreground' }
  return { text: short, cls: 'text-muted-foreground' }
}

export default async function JogosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  let fixtures = await getFixturesByDate(today).catch(() => [])

  // Filtrar apenas ligas destaque
  const featuredIds = new Set(FEATURED_LEAGUES.map(l => l.id))
  fixtures = fixtures.filter(f => featuredIds.has(f.league.id))

  // Buscar quais jogos já têm análise em cache
  const fixtureIds = fixtures.map(f => f.fixture.id)
  const { data: analysed } = await supabase
    .from('game_analyses')
    .select('fixture_id')
    .in('fixture_id', fixtureIds)
    .returns<Array<{ fixture_id: number }>>()
  const analysedIds = new Set((analysed ?? []).map(a => a.fixture_id))

  // Agrupar por liga
  const byLeague: Record<string, typeof fixtures> = {}
  for (const f of fixtures) {
    const key = f.league.name
    if (!byLeague[key]) byLeague[key] = []
    byLeague[key].push(f)
  }

  return (
    <div className="p-4 space-y-5 pb-24">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Jogos de hoje</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {fixtures.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-semibold">Nenhum jogo hoje</p>
          <p className="text-sm text-muted-foreground">Sem jogos nas ligas monitoradas.</p>
        </div>
      )}

      {Object.entries(byLeague).map(([leagueName, games]) => (
        <div key={leagueName} className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{leagueName}</p>
          </div>

          {games.map(f => {
            const status = statusLabel(f.fixture.status.short)
            const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(f.fixture.status.short)
            const isFinished = f.fixture.status.short === 'FT'
            const hasAnalysis = analysedIds.has(f.fixture.id)
            const time = new Date(f.fixture.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

            return (
              <Link
                key={f.fixture.id}
                href={`/jogos/${f.fixture.id}`}
                className="block bg-card rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Times */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-medium', isFinished && f.goals.home !== null && f.goals.home > (f.goals.away ?? 0) && 'text-primary')}>
                        {f.teams.home.name}
                      </span>
                      {isLive || isFinished ? (
                        <span className={cn('text-lg font-bold tabular-nums', isLive && 'text-primary')}>
                          {f.goals.home ?? 0}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm font-medium', isFinished && f.goals.away !== null && f.goals.away > (f.goals.home ?? 0) && 'text-primary')}>
                        {f.teams.away.name}
                      </span>
                      {isLive || isFinished ? (
                        <span className={cn('text-lg font-bold tabular-nums', isLive && 'text-primary')}>
                          {f.goals.away ?? 0}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Status / Hora */}
                  <div className="flex flex-col items-center gap-1 shrink-0 w-16">
                    {isLive ? (
                      <span className="text-xs font-bold text-green-400 animate-pulse">
                        {f.fixture.status.elapsed}&apos;
                      </span>
                    ) : isFinished ? (
                      <span className="text-xs text-muted-foreground">FT</span>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {time}
                      </div>
                    )}
                    {hasAnalysis && (
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
