import { NextRequest, NextResponse } from 'next/server'
import { searchFixture, getFixturePredictions, getFixtureLineups, getFixtureInjuries, getStandings, getH2H, getTeamSeasonStats } from '@/lib/api-football'

// Rota de diagnóstico — só funciona em desenvolvimento
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Apenas em desenvolvimento' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const home = searchParams.get('home') ?? 'Flamengo'
  const away = searchParams.get('away') ?? 'Vasco'
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const fixture = await searchFixture(home, away, date)

  if (!fixture) {
    return NextResponse.json({
      found: false,
      searched: { home, away, date },
      message: 'Fixture não encontrado — verifique nomes dos times e data',
    })
  }

  const fid = fixture.fixture.id
  const homeId = fixture.teams.home.id
  const awayId = fixture.teams.away.id
  const leagueId = fixture.league.id
  const season = fixture.league.season

  const [pred, lu, inj, standings, h2h, hStats, aStats] = await Promise.allSettled([
    getFixturePredictions(fid),
    getFixtureLineups(fid),
    getFixtureInjuries(fid),
    getStandings(leagueId, season),
    getH2H(homeId, awayId),
    getTeamSeasonStats(homeId, leagueId, season),
    getTeamSeasonStats(awayId, leagueId, season),
  ])

  return NextResponse.json({
    found: true,
    fixture: {
      id: fid,
      home: fixture.teams.home.name,
      away: fixture.teams.away.name,
      league: fixture.league.name,
      season,
      date: fixture.fixture.date,
      status: fixture.fixture.status.long,
    },
    data_available: {
      predictions: pred.status === 'fulfilled' && !!pred.value,
      lineups: lu.status === 'fulfilled' ? lu.value.length : 0,
      injuries: inj.status === 'fulfilled' ? inj.value.length : 0,
      standings: standings.status === 'fulfilled' ? standings.value.length : 0,
      h2h: h2h.status === 'fulfilled' ? h2h.value.length : 0,
      home_stats: hStats.status === 'fulfilled' && !!hStats.value,
      away_stats: aStats.status === 'fulfilled' && !!aStats.value,
    },
    predictions_sample: pred.status === 'fulfilled' && pred.value ? {
      winner: pred.value.predictions?.winner?.name,
      percent: pred.value.predictions?.percent,
      advice: pred.value.predictions?.advice,
    } : null,
    errors: {
      predictions: pred.status === 'rejected' ? String(pred.reason) : null,
      lineups: lu.status === 'rejected' ? String(lu.reason) : null,
      standings: standings.status === 'rejected' ? String(standings.reason) : null,
      h2h: h2h.status === 'rejected' ? String(h2h.reason) : null,
    },
  })
}
