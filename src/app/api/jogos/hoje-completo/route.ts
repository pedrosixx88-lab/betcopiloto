import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFixturesByDate, FEATURED_LEAGUES } from '@/lib/api-football'

export const dynamic = 'force-dynamic'

function getDateBRT(offsetDays: number): string {
  const now = new Date()
  // Formata direto em BRT sem converter para UTC
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const d = parts.find(p => p.type === 'day')!.value
  const base = new Date(`${y}-${m}-${d}T12:00:00`)
  base.setDate(base.getDate() + offsetDays)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
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

  const today = getDateBRT(0)
  const yesterday = getDateBRT(-1)

  // Busca hoje + ontem em paralelo — jogos noturnos podem estar na data anterior em UTC
  const [todayFixtures, yesterdayFixtures] = await Promise.all([
    getFixturesByDate(today).catch(() => []),
    getFixturesByDate(yesterday).catch(() => []),
  ])

  // Do ontem, só incluir jogos que ainda não encerraram OU encerraram hoje (por horário BRT)
  const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const todayStr = getDateBRT(0)

  const relevantYesterday = yesterdayFixtures.filter(f => {
    const kickoff = new Date(f.fixture.date)
    const kickoffBRT = new Date(kickoff.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const kickoffDateBRT = `${kickoffBRT.getFullYear()}-${String(kickoffBRT.getMonth()+1).padStart(2,'0')}-${String(kickoffBRT.getDate()).padStart(2,'0')}`
    // Só incluir se o horário BRT do kickoff for hoje
    return kickoffDateBRT === todayStr
  })

  const allFixtures = [...relevantYesterday, ...todayFixtures]
  const filtered = allFixtures.filter(f => featuredIds.has(f.league.id))

  // Buscar quais jogos têm análise em cache
  const fixtureIds = filtered.map(f => f.fixture.id)
  const { data: analysed } = await supabase
    .from('game_analyses')
    .select('fixture_id')
    .in('fixture_id', fixtureIds)
    .returns<Array<{ fixture_id: number }>>()
  const analysedIds = new Set((analysed ?? []).map(a => a.fixture_id))

  const LIVE_STATUS = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']
  const nowMs = Date.now()

  const games = filtered
    .map(f => {
      let status = f.fixture.status.short
      // Fallback: API plano gratuito às vezes não atualiza o status final.
      // Se o jogo consta como "ao vivo" mas já passou 3h do kickoff, forçar FT.
      if (LIVE_STATUS.includes(status)) {
        const kickoffMs = new Date(f.fixture.date).getTime()
        const elapsed = nowMs - kickoffMs
        if (elapsed > 2.5 * 60 * 60 * 1000) status = 'FT'
      }
      return {
        fixture_id: f.fixture.id,
        home_team: f.teams.home.name,
        away_team: f.teams.away.name,
        league: leagueMap[f.league.id]?.name ?? f.league.name,
        country: leagueMap[f.league.id]?.country ?? f.league.country,
        time: new Date(f.fixture.date).toLocaleTimeString('pt-BR', {
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
        }),
        status,
        home_goals: f.goals.home,
        away_goals: f.goals.away,
        elapsed: f.fixture.status.elapsed,
        has_analysis: analysedIds.has(f.fixture.id),
      }
    })
    .sort((a, b) => a.time.localeCompare(b.time))

  const days = games.length > 0
    ? [{ date: today, label: dateLabel(today), games }]
    : []

  return NextResponse.json({ success: true, days })
}
