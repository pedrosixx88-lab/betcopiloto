import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFixturesByDate, FEATURED_LEAGUES } from '@/lib/api-football'

const FINISHED = ['FT', 'AET', 'PEN', 'ABD', 'WO', 'AWD', 'CANC']

function getDateBRT(offsetDays: number): string {
  const now = new Date()
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
  const dates = [getDateBRT(0), getDateBRT(1), getDateBRT(2)]

  const results = await Promise.all(dates.map(d => getFixturesByDate(d).catch(() => [])))

  const days: { date: string; label: string; games: object[] }[] = []

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]
    const fixtures = results[i]

    const games = fixtures
      .filter(f => featuredIds.has(f.league.id) && !FINISHED.includes(f.fixture.status.short))
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
      }))
      .sort((a, b) => a.time.localeCompare(b.time))

    if (games.length > 0) {
      days.push({ date, label: dateLabel(date), games })
    }
  }

  return NextResponse.json({ success: true, days })
}
