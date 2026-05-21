import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFixturesByDate, FEATURED_LEAGUES } from '@/lib/api-football'

function getDateBRT(offsetDays: number): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

function dateLabel(dateStr: string): string {
  const today = getDateBRT(0)
  const tomorrow = getDateBRT(1)
  if (dateStr === today) return 'Hoje'
  if (dateStr === tomorrow) return 'Amanhã'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const featuredIds = new Set(FEATURED_LEAGUES.map(l => l.id))
  const leagueMap = Object.fromEntries(FEATURED_LEAGUES.map(l => [l.id, l]))

  // Só hoje — encerrados somem na virada do dia
  const today = getDateBRT(0)
  const fixtures = await getFixturesByDate(today).catch(() => [])

  const filtered = fixtures.filter(f => featuredIds.has(f.league.id))

  // Buscar quais jogos têm análise em cache
  const fixtureIds = filtered.map(f => f.fixture.id)
  const { data: analysed } = await supabase
    .from('game_analyses')
    .select('fixture_id')
    .in('fixture_id', fixtureIds)
    .returns<Array<{ fixture_id: number }>>()
  const analysedIds = new Set((analysed ?? []).map(a => a.fixture_id))

  const games = filtered
    .map(f => ({
      fixture_id: f.fixture.id,
      home_team: f.teams.home.name,
      away_team: f.teams.away.name,
      league: leagueMap[f.league.id]?.name ?? f.league.name,
      country: leagueMap[f.league.id]?.country ?? f.league.country,
      time: new Date(f.fixture.date).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
      }),
      status: f.fixture.status.short,
      home_goals: f.goals.home,
      away_goals: f.goals.away,
      elapsed: f.fixture.status.elapsed,
      has_analysis: analysedIds.has(f.fixture.id),
    }))
    .sort((a, b) => a.time.localeCompare(b.time))

  const days = games.length > 0
    ? [{ date: today, label: dateLabel(today), games }]
    : []

  return NextResponse.json({ success: true, days })
}
