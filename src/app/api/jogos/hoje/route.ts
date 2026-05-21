import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFixturesByDate, FEATURED_LEAGUES } from '@/lib/api-football'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]

  const fixtures = await getFixturesByDate(today).catch(() => [])
  const featuredIds = new Set(FEATURED_LEAGUES.map(l => l.id))

  const games = fixtures
    .filter(f => featuredIds.has(f.league.id))
    .map(f => ({
      fixture_id: f.fixture.id,
      home_team: f.teams.home.name,
      away_team: f.teams.away.name,
      league: f.league.name,
      time: new Date(f.fixture.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      status: f.fixture.status.short,
    }))

  return NextResponse.json({ success: true, games })
}
