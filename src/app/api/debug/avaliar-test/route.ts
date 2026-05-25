import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  searchFixture,
  getFixturePredictions,
  getFixtureLineups,
  getFixtureInjuries,
  getFixtureStats,
  getStandings,
  getH2H,
  getTeamSeasonStats,
  getLastMatches,
  getFixtureOdds,
} from '@/lib/api-football'

// Endpoint de teste — só funciona em desenvolvimento, sem autenticação
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Apenas em desenvolvimento' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('screenshot') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Extrai jogos do bilhete
  const extractRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `Extraia os jogos deste bilhete de apostas. Retorne APENAS JSON:
{
  "total_odd": 4.00,
  "stake": null,
  "legs": [
    {
      "home_team": "Paderborn",
      "away_team": "Wolfsburg",
      "selection": "Wolfsburg vence",
      "market": "match_winner",
      "odd": 2.00,
      "match_date": "2026-05-25"
    }
  ]
}
market: match_winner | over_under | both_teams_score | handicap | corners | cards | correct_score | other`,
        },
      ],
    }],
  })

  const extractText = extractRes.content[0].type === 'text' ? extractRes.content[0].text : ''
  const match = extractText.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Não consegui ler o bilhete', raw: extractText })

  let ticketData: any
  try { ticketData = JSON.parse(match[0]) } catch {
    return NextResponse.json({ error: 'JSON inválido', raw: match[0] })
  }

  const avgArr = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 'N/D'

  const legsWithData = await Promise.all(
    ticketData.legs.map(async (leg: any) => {
      try {
        const fixture = await searchFixture(leg.home_team, leg.away_team, leg.match_date)
        if (!fixture) return { leg, data: null, reason: 'Jogo não encontrado' }

        const fid = fixture.fixture.id
        const homeId = fixture.teams.home.id
        const awayId = fixture.teams.away.id
        const leagueId = fixture.league.id
        const fixtureSeason = fixture.league.season ?? new Date().getFullYear()

        console.log(`[debug/avaliar-test] FOUND: ${fixture.teams.home.name} vs ${fixture.teams.away.name} | fid=${fid} | season=${fixtureSeason}`)

        const [
          predResult, lineupsResult, injuriesResult, fixtureStatsResult,
          standingsResult, h2hResult, homeStatsResult, awayStatsResult,
          homeFormResult, awayFormResult, oddsResult,
        ] = await Promise.allSettled([
          getFixturePredictions(fid),
          getFixtureLineups(fid),
          getFixtureInjuries(fid),
          getFixtureStats(fid),
          getStandings(leagueId, fixtureSeason),
          getH2H(homeId, awayId),
          getTeamSeasonStats(homeId, leagueId, fixtureSeason),
          getTeamSeasonStats(awayId, leagueId, fixtureSeason),
          getLastMatches(homeId, 5),
          getLastMatches(awayId, 5),
          getFixtureOdds(fid),
        ])

        const pred = predResult.status === 'fulfilled' ? (predResult.value ?? null) : null
        const lu = lineupsResult.status === 'fulfilled' ? (lineupsResult.value ?? []) : []
        const inj = injuriesResult.status === 'fulfilled' ? (injuriesResult.value ?? []) : []
        const stats = fixtureStatsResult.status === 'fulfilled' ? (fixtureStatsResult.value ?? []) : []
        const standingsRaw = standingsResult.status === 'fulfilled' ? (standingsResult.value ?? []) : []
        const h2hRaw = h2hResult.status === 'fulfilled' ? (h2hResult.value ?? []) : []
        const homeStats = homeStatsResult.status === 'fulfilled' ? (homeStatsResult.value ?? null) : null
        const awayStats = awayStatsResult.status === 'fulfilled' ? (awayStatsResult.value ?? null) : null
        const homeFormRaw = homeFormResult.status === 'fulfilled' ? (homeFormResult.value ?? []) : []
        const awayFormRaw = awayFormResult.status === 'fulfilled' ? (awayFormResult.value ?? []) : []
        const oddsRaw = oddsResult.status === 'fulfilled' ? (oddsResult.value ?? []) : []

        const summary = {
          fixture: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
          fid, leagueId, season: fixtureSeason,
          pred: !!pred,
          lineups: lu.length,
          injuries: inj.length,
          fixture_stats: stats.length,
          standings: standingsRaw.length,
          h2h: h2hRaw.length,
          home_stats: !!homeStats,
          away_stats: !!awayStats,
          home_form: homeFormRaw.length,
          away_form: awayFormRaw.length,
          odds: oddsRaw.length,
          errors: {
            pred: predResult.status === 'rejected' ? String(predResult.reason) : null,
            standings: standingsResult.status === 'rejected' ? String(standingsResult.reason) : null,
            h2h: h2hResult.status === 'rejected' ? String(h2hResult.reason) : null,
            homeForm: homeFormResult.status === 'rejected' ? String(homeFormResult.reason) : null,
            awayForm: awayFormResult.status === 'rejected' ? String(awayFormResult.reason) : null,
          },
        }

        console.log('[debug/avaliar-test] DATA:', JSON.stringify(summary))

        return { leg, summary, fixture: fixture.teams }
      } catch (err) {
        console.error('[debug/avaliar-test] leg error:', err)
        return { leg, data: null, error: String(err) }
      }
    })
  )

  return NextResponse.json({
    extracted: ticketData,
    legs_data: legsWithData,
    message: 'Dados coletados — verificar se pred/standings/h2h/form têm dados',
  })
}
