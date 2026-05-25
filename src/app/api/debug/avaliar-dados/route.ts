import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  searchFixture, getFixturePredictions, getFixtureLineups,
  getFixtureInjuries, getFixtureStats, getStandings,
  getH2H, getTeamSeasonStats, getLastMatches, getFixtureOdds,
} from '@/lib/api-football'

// Testa coleta de dados + análise Claude sem precisar de imagem (só dev)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Apenas em desenvolvimento' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const home1 = searchParams.get('home1') ?? 'Paderborn'
  const away1 = searchParams.get('away1') ?? 'Wolfsburg'
  const home2 = searchParams.get('home2') ?? 'Botafogo SP'
  const away2 = searchParams.get('away2') ?? 'Athletic Club MG'
  const date = searchParams.get('date') ?? '2026-05-25'

  const ticketData = {
    total_odd: 4.00,
    stake: null,
    legs: [
      { home_team: home1, away_team: away1, selection: `${away1} vence`, market: 'match_winner', odd: 2.00, match_date: date },
      { home_team: home2, away_team: away2, selection: `${home2} vence`, market: 'match_winner', odd: 2.00, match_date: date },
    ],
  }

  const avgArr = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 'N/D'

  const legsWithData = await Promise.all(
    ticketData.legs.map(async (leg) => {
      try {
        const fixture = await searchFixture(leg.home_team, leg.away_team, leg.match_date)
        if (!fixture) return { leg, data: null, reason: 'Jogo não encontrado' }

        const fid = fixture.fixture.id
        const homeId = fixture.teams.home.id
        const awayId = fixture.teams.away.id
        const leagueId = fixture.league.id
        const fixtureSeason = fixture.league.season ?? new Date().getFullYear()

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

        const allStandings: any[] = []
        standingsRaw.forEach((group: any) => {
          if (Array.isArray(group)) allStandings.push(...group)
          else if (group?.league?.standings) group.league.standings.forEach((s: any[]) => allStandings.push(...s))
          else if (group?.standings) group.standings.forEach((s: any[]) => allStandings.push(...s))
        })
        const hs = allStandings.find((s: any) => s.team?.id === homeId)
        const as_ = allStandings.find((s: any) => s.team?.id === awayId)

        const homeLineup = lu.find((l: any) => l.team?.id === homeId)
        const awayLineup = lu.find((l: any) => l.team?.id === awayId)

        const fmtFormMatch = (m: any, teamId: number) => {
          const isHome = m.teams?.home?.id === teamId
          const tg = isHome ? (m.goals?.home ?? '?') : (m.goals?.away ?? '?')
          const og = isHome ? (m.goals?.away ?? '?') : (m.goals?.home ?? '?')
          const opp = isHome ? m.teams?.away?.name : m.teams?.home?.name
          const date = m.fixture?.date?.split('T')[0] ?? '?'
          const loc = isHome ? 'Casa' : 'Fora'
          const res = typeof tg === 'number' && typeof og === 'number' ? (tg > og ? 'V' : tg < og ? 'D' : 'E') : '?'
          return `${date} [${loc}] vs ${opp}: ${tg}x${og} [${res}]`
        }

        const mwHome: number[] = []; const mwDraw: number[] = []; const mwAway: number[] = []
        for (const bk of oddsRaw.slice(0, 5)) {
          const mw = bk.bets?.find((b: any) => b.id === 1 || b.name?.toLowerCase()?.includes('match winner'))
          if (mw) {
            const h = parseFloat(mw.values?.find((v: any) => v.value === 'Home')?.odd ?? '0')
            const d = parseFloat(mw.values?.find((v: any) => v.value === 'Draw')?.odd ?? '0')
            const a = parseFloat(mw.values?.find((v: any) => v.value === 'Away')?.odd ?? '0')
            if (h > 1) mwHome.push(h); if (d > 1) mwDraw.push(d); if (a > 1) mwAway.push(a)
          }
        }

        const jogosTexto = `
════════════════════════════════════════
JOGO: ${fixture.teams.home.name} vs ${fixture.teams.away.name}
Liga: ${fixture.league.name} | Data: ${fixture.fixture.date?.split('T')[0]} | Status: ${fixture.fixture.status.long}
SELEÇÃO DO APOSTADOR: ${leg.selection} @ ${leg.odd}x
════════════════════════════════════════

PREVISÃO API:
${pred ? `  Favorito: ${pred.predictions?.winner?.name ?? 'N/D'}
  %: casa ${pred.predictions?.percent?.home ?? 'N/D'} | empate ${pred.predictions?.percent?.draw ?? 'N/D'} | fora ${pred.predictions?.percent?.away ?? 'N/D'}
  Poisson: ${pred.comparison?.poisson_distribution?.home ?? 'N/D'} vs ${pred.comparison?.poisson_distribution?.away ?? 'N/D'}
  Conselho: ${pred.predictions?.advice ?? 'N/D'}` : '  Não disponível'}

TABELA:
${hs ? `  ${fixture.teams.home.name}: ${hs.rank}º | ${hs.points}pts | ${hs.all?.played}J ${hs.all?.win}V ${hs.all?.draw}E ${hs.all?.lose}D | forma: ${hs.form ?? 'N/D'}` : `  ${fixture.teams.home.name}: N/D`}
${as_ ? `  ${fixture.teams.away.name}: ${as_.rank}º | ${as_.points}pts | ${as_.all?.played}J ${as_.all?.win}V ${as_.all?.draw}E ${as_.all?.lose}D | forma: ${as_.form ?? 'N/D'}` : `  ${fixture.teams.away.name}: N/D`}

H2H (últimos ${h2hRaw.length} jogos): ${h2hRaw.length > 0 ? h2hRaw.slice(0, 3).map((m: any) => `${m.fixture?.date?.split('T')[0]}: ${m.teams?.home?.name} ${m.score?.fulltime?.home}x${m.score?.fulltime?.away} ${m.teams?.away?.name}`).join(' | ') : 'N/D'}

FORMA RECENTE ${fixture.teams.home.name}: ${homeFormRaw.length > 0 ? homeFormRaw.slice(0, 5).map((m: any) => fmtFormMatch(m, homeId)).join(' | ') : 'N/D'}
FORMA RECENTE ${fixture.teams.away.name}: ${awayFormRaw.length > 0 ? awayFormRaw.slice(0, 5).map((m: any) => fmtFormMatch(m, awayId)).join(' | ') : 'N/D'}

ODDS MERCADO: ${fixture.teams.home.name} avg ${avgArr(mwHome)} | Empate avg ${avgArr(mwDraw)} | ${fixture.teams.away.name} avg ${avgArr(mwAway)} (de ${oddsRaw.length} casas)

LESÕES: ${inj.length > 0 ? inj.slice(0, 5).map((p: any) => `${p.player?.name} (${p.team?.name})`).join(', ') : 'nenhuma registrada'}
ESCALAÇÃO: ${homeLineup ? `${fixture.teams.home.name} ${homeLineup.formation}` : 'não confirmada'} | ${awayLineup ? `${fixture.teams.away.name} ${awayLineup.formation}` : 'não confirmada'}
`.trim()

        return {
          leg,
          fixture: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
          data_summary: {
            pred: !!pred, lu: lu.length, inj: inj.length, standings: allStandings.length,
            h2h: h2hRaw.length, homeStats: !!homeStats, awayStats: !!awayStats,
            homeForm: homeFormRaw.length, awayForm: awayFormRaw.length, odds: oddsRaw.length,
          },
          text_para_claude: jogosTexto,
        }
      } catch (err) {
        return { leg, data: null, error: String(err) }
      }
    })
  )

  // Verificar se tem dados antes de chamar Claude
  const temDados = legsWithData.some((l: any) => l.data_summary?.pred || l.data_summary?.standings > 0)

  if (!temDados) {
    return NextResponse.json({
      status: 'sem_dados',
      message: 'API não retornou dados para estes jogos (limite diário ou jogos não encontrados)',
      legs: legsWithData,
    })
  }

  // Chamar Claude com os dados reais
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const jogosTextoFull = legsWithData.map((l: any) => l.text_para_claude ?? `${l.leg.home_team} vs ${l.leg.away_team}: jogo não localizado`).join('\n\n')

  const claudeRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Analise este bilhete duplo. Use os dados abaixo. Retorne JSON:
{"legs":[{"jogo":"A vs B","selecao":"X","odd":2,"avaliacao":"FAVORÁVEL|NEUTRO|DESFAVORÁVEL|DADOS INSUFICIENTES","confianca":"alta|média|baixa","justificativa":"...","alerta":null}],"resumo":{"parecer":"..."}}

REGRA: Use apenas dados fornecidos. DADOS INSUFICIENTES somente se previsão E tabela E H2H forem todos indisponíveis.

${jogosTextoFull}`,
    }],
  })

  const text = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  let analysis = null
  try { if (jsonMatch) analysis = JSON.parse(jsonMatch[0]) } catch { /* ignore */ }

  return NextResponse.json({
    status: 'ok',
    legs: legsWithData.map((l: any) => ({ fixture: l.fixture, data_summary: l.data_summary })),
    analysis,
    raw_claude: analysis ? undefined : text,
  })
}
