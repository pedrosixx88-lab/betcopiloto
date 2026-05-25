import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
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

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!rateLimit(`avaliar:${user.id}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Aguarde alguns minutos.' }, { status: 429 })
  }

  // Gate: Pro ou 1 uso gratuito
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, current_bankroll, avaliacoes_gratuitas')
    .eq('id', user.id)
    .single<{ plan: string; plan_expires_at: string | null; current_bankroll: number; avaliacoes_gratuitas: number }>()

  const isPro = profile?.plan === 'pro' &&
    (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date())
  const avaliacoesUsadas = profile?.avaliacoes_gratuitas ?? 0

  if (!isPro && avaliacoesUsadas >= 1) {
    return NextResponse.json({ error: 'upgrade_required', message: 'Você já usou sua análise gratuita. Assine o Pro para continuar.' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('screenshot') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Imagem muito grande. Máximo 10MB.' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // PASSO 1 — Extrair jogos do bilhete via Vision
  const extractRes = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `Extraia os jogos deste bilhete de apostas. Retorne APENAS JSON no formato:
{
  "total_odd": 8.50,
  "stake": 50.00,
  "legs": [
    {
      "home_team": "Flamengo",
      "away_team": "Vasco",
      "selection": "Flamengo vence",
      "market": "match_winner",
      "odd": 1.80,
      "match_date": "2026-05-25"
    }
  ]
}
Se não conseguir identificar stake ou total_odd, use null.
market deve ser: match_winner | over_under | both_teams_score | handicap | corners | cards | correct_score | other`,
        },
      ],
    }],
  })

  const extractText = extractRes.content[0].type === 'text' ? extractRes.content[0].text : ''
  const extractMatch = extractText.match(/\{[\s\S]*\}/)
  if (!extractMatch) return NextResponse.json({ error: 'Não consegui ler o bilhete. Tente uma foto mais nítida.' }, { status: 400 })

  let ticketData: { total_odd: number | null; stake: number | null; legs: Array<{ home_team: string; away_team: string; selection: string; market: string; odd: number; match_date: string }> }
  try { ticketData = JSON.parse(extractMatch[0]) } catch {
    return NextResponse.json({ error: 'Erro ao processar bilhete.' }, { status: 400 })
  }

  if (!ticketData.legs?.length) return NextResponse.json({ error: 'Nenhum jogo encontrado no bilhete.' }, { status: 400 })

  const bankroll = profile?.current_bankroll ?? 0

  // ── helpers para médias de odds ──
  const avgArr = (arr: number[]) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 'N/D'

  // PASSO 2 — Buscar TODOS os dados disponíveis para cada jogo
  const legsWithData = await Promise.all(
    ticketData.legs.map(async (leg) => {
      try {
        const fixture = await searchFixture(leg.home_team, leg.away_team, leg.match_date)
        if (!fixture) {
          console.log(`[avaliar] NOT FOUND: ${leg.home_team} vs ${leg.away_team} @ ${leg.match_date}`)
          return { leg, data: null, reason: 'Jogo não encontrado na API' }
        }

        const fid = fixture.fixture.id
        const homeId = fixture.teams.home.id
        const awayId = fixture.teams.away.id
        const leagueId = fixture.league.id
        // API-Football usa o ano de INÍCIO da temporada (2025/26 = season 2025)
        const fixtureSeason = fixture.league.season ?? new Date().getFullYear()

        console.log(`[avaliar] FOUND: ${fixture.teams.home.name} vs ${fixture.teams.away.name} | fid=${fid} | league=${fixture.league.name} | season=${fixtureSeason}`)

        // Busca paralela de TODOS os endpoints disponíveis
        const [
          predResult,
          lineupsResult,
          injuriesResult,
          fixtureStatsResult,
          standingsResult,
          h2hResult,
          homeStatsResult,
          awayStatsResult,
          homeFormResult,
          awayFormResult,
          oddsResult,
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

        const pred = predResult.status === 'fulfilled' ? predResult.value : null
        const lu = lineupsResult.status === 'fulfilled' ? lineupsResult.value : []
        const inj = injuriesResult.status === 'fulfilled' ? injuriesResult.value : []
        const stats = fixtureStatsResult.status === 'fulfilled' ? fixtureStatsResult.value : []
        const standingsRaw = standingsResult.status === 'fulfilled' ? standingsResult.value : []
        const h2hRaw = h2hResult.status === 'fulfilled' ? h2hResult.value : []
        const homeStats = homeStatsResult.status === 'fulfilled' ? homeStatsResult.value : null
        const awayStats = awayStatsResult.status === 'fulfilled' ? awayStatsResult.value : null
        const homeFormRaw = homeFormResult.status === 'fulfilled' ? homeFormResult.value : []
        const awayFormRaw = awayFormResult.status === 'fulfilled' ? awayFormResult.value : []
        const oddsRaw = oddsResult.status === 'fulfilled' ? oddsResult.value : []

        console.log(`[avaliar] data: pred=${!!pred} lu=${lu.length} inj=${inj.length} std=${standingsRaw.length} h2h=${h2hRaw.length} hStats=${!!homeStats} aStats=${!!awayStats} hForm=${homeFormRaw.length} aForm=${awayFormRaw.length} odds=${oddsRaw.length}`)

        // ── Standings ──
        const allStandings: any[] = []
        standingsRaw.forEach((group: any) => {
          if (Array.isArray(group)) allStandings.push(...group)
          else if (group?.league?.standings) {
            // Estrutura real da API: { league: { standings: [[...times...]] } }
            group.league.standings.forEach((s: any[]) => allStandings.push(...s))
          } else if (group?.standings) {
            group.standings.forEach((s: any[]) => allStandings.push(...s))
          }
        })
        const findStanding = (teamId: number) => allStandings.find((s: any) => s.team?.id === teamId)
        const homeStanding = findStanding(homeId)
        const awayStanding = findStanding(awayId)

        // ── Escalações ──
        const homeLineup = lu.find((l: any) => l.team?.id === homeId)
        const awayLineup = lu.find((l: any) => l.team?.id === awayId)

        // ── Lesões ──
        const injuriesFormatted = inj.map((p: any) => ({
          player: p.player?.name ?? 'N/D',
          team: p.team?.name ?? 'N/D',
          type: p.type ?? 'Indisponível',
          reason: p.reason ?? null,
        }))

        // ── Estatísticas do jogo (se já aconteceu) ──
        const getTeamStat = (teamId: number, statType: string) => {
          const t = stats.find((s: any) => s.team?.id === teamId)
          return t?.statistics?.find((s: any) => s.type === statType)?.value ?? null
        }

        // ── H2H ──
        const h2hList = h2hRaw.slice(0, 5).map((m: any) => {
          const hg = m.score?.fulltime?.home ?? m.goals?.home
          const ag = m.score?.fulltime?.away ?? m.goals?.away
          const date = m.fixture?.date?.split('T')[0] ?? 'N/D'
          const hName = m.teams?.home?.name
          const aName = m.teams?.away?.name
          const winner = (hg !== null && ag !== null)
            ? (hg > ag ? hName : ag > hg ? aName : 'Empate')
            : 'N/D'
          return `${date}: ${hName} ${hg ?? '?'}x${ag ?? '?'} ${aName} → ${winner}`
        })
        let h2hHomeWins = 0; let h2hAwayWins = 0; let h2hDraws = 0; let h2hTotalGoals = 0
        for (const m of h2hRaw) {
          const hg = m.score?.fulltime?.home ?? m.goals?.home
          const ag = m.score?.fulltime?.away ?? m.goals?.away
          if (typeof hg !== 'number' || typeof ag !== 'number') continue
          h2hTotalGoals += hg + ag
          const mHomeIsHome = m.teams?.home?.id === homeId
          if (hg === ag) h2hDraws++
          else if ((mHomeIsHome && hg > ag) || (!mHomeIsHome && ag > hg)) h2hHomeWins++
          else h2hAwayWins++
        }
        const h2hAvgGoals = h2hRaw.length > 0 ? (h2hTotalGoals / h2hRaw.length).toFixed(1) : 'N/D'

        // ── Forma recente (últimas 5 partidas) ──
        const fmtFormMatch = (m: any, teamId: number) => {
          const isHome = m.teams?.home?.id === teamId
          const tg = isHome ? (m.goals?.home ?? '?') : (m.goals?.away ?? '?')
          const og = isHome ? (m.goals?.away ?? '?') : (m.goals?.home ?? '?')
          const opp = isHome ? m.teams?.away?.name : m.teams?.home?.name
          const date = m.fixture?.date?.split('T')[0] ?? '?'
          const loc = isHome ? 'Casa' : 'Fora'
          const res = typeof tg === 'number' && typeof og === 'number'
            ? (tg > og ? 'V' : tg < og ? 'D' : 'E') : '?'
          return `  ${date} [${loc}] vs ${opp} (${m.league?.name ?? 'N/D'}): ${tg}x${og} [${res}]`
        }
        const homeFormList = homeFormRaw.slice(0, 5).map((m: any) => fmtFormMatch(m, homeId))
        const awayFormList = awayFormRaw.slice(0, 5).map((m: any) => fmtFormMatch(m, awayId))

        // ── Estatísticas da temporada ──
        const fmtSeasonStats = (ts: any, name: string, isHomeTeam: boolean) => {
          if (!ts) return `  ${name}: estatísticas não disponíveis`
          const f = ts.fixtures; const g = ts.goals; const cs = ts.clean_sheet
          const fails = ts.failed_to_score; const big = ts.biggest
          const loc = isHomeTeam ? 'home' : 'away'
          const locLabel = isHomeTeam ? 'em casa' : 'fora'
          return [
            `  ${name}:`,
            `    Geral: ${f?.played?.total ?? 'N/D'}J | ${f?.wins?.total ?? 'N/D'}V ${f?.draws?.total ?? 'N/D'}E ${f?.loses?.total ?? 'N/D'}D`,
            `    Gols marcados: ${g?.for?.total?.total ?? 'N/D'} (avg ${g?.for?.average?.total ?? 'N/D'}/jogo) | Gols sofridos: ${g?.against?.total?.total ?? 'N/D'} (avg ${g?.against?.average?.total ?? 'N/D'}/jogo)`,
            `    ${locLabel.charAt(0).toUpperCase() + locLabel.slice(1)}: ${f?.played?.[loc] ?? 'N/D'}J | ${f?.wins?.[loc] ?? 'N/D'}V ${f?.draws?.[loc] ?? 'N/D'}E ${f?.loses?.[loc] ?? 'N/D'}D | Gols marc: ${g?.for?.total?.[loc] ?? 'N/D'} | Gols sofr: ${g?.against?.total?.[loc] ?? 'N/D'}`,
            `    Clean sheets ${locLabel}: ${cs?.[loc] ?? 'N/D'} | Sem marcar ${locLabel}: ${fails?.[loc] ?? 'N/D'}`,
            `    Maior vitória ${locLabel}: ${big?.wins?.[loc] ?? 'N/D'} | Maior derrota ${locLabel}: ${big?.loses?.[loc] ?? 'N/D'}`,
            `    Forma atual: ${ts.form ?? 'N/D'}`,
          ].join('\n')
        }

        // ── Odds de mercado ──
        const mwHome: number[] = []; const mwDraw: number[] = []; const mwAway: number[] = []
        const ou25Over: number[] = []; const ou25Under: number[] = []
        for (const bk of oddsRaw.slice(0, 8)) {
          const mw = bk.bets?.find((b: any) => b.id === 1 || b.name?.toLowerCase()?.includes('match winner'))
          if (mw) {
            const h = parseFloat(mw.values?.find((v: any) => v.value === 'Home')?.odd ?? '0')
            const d = parseFloat(mw.values?.find((v: any) => v.value === 'Draw')?.odd ?? '0')
            const a = parseFloat(mw.values?.find((v: any) => v.value === 'Away')?.odd ?? '0')
            if (h > 1) mwHome.push(h); if (d > 1) mwDraw.push(d); if (a > 1) mwAway.push(a)
          }
          const ou = bk.bets?.find((b: any) => b.name?.toLowerCase()?.includes('over/under') || b.name?.toLowerCase()?.includes('goals'))
          if (ou) {
            const o = parseFloat(ou.values?.find((v: any) => v.value === 'Over 2.5')?.odd ?? '0')
            const u = parseFloat(ou.values?.find((v: any) => v.value === 'Under 2.5')?.odd ?? '0')
            if (o > 1) ou25Over.push(o); if (u > 1) ou25Under.push(u)
          }
        }

        return {
          leg,
          fixture: {
            id: fid,
            home: fixture.teams.home.name,
            away: fixture.teams.away.name,
            league: fixture.league.name,
            date: fixture.fixture.date,
            status: fixture.fixture.status.long,
          },
          data: {
            predictions: pred ? {
              winner: pred.predictions?.winner?.name ?? null,
              percent: pred.predictions?.percent ?? null,
              advice: pred.predictions?.advice ?? null,
              goals_home: pred.predictions?.goals?.home ?? null,
              goals_away: pred.predictions?.goals?.away ?? null,
              under_over: pred.predictions?.under_over ?? null,
              win_or_draw: pred.predictions?.win_or_draw ?? null,
              comparison: pred.comparison ?? null,
            } : null,
            standings: {
              home: homeStanding ? {
                position: homeStanding.rank,
                points: homeStanding.points,
                played: homeStanding.all?.played,
                won: homeStanding.all?.win,
                drawn: homeStanding.all?.draw,
                lost: homeStanding.all?.lose,
                goals_for: homeStanding.all?.goals?.for,
                goals_against: homeStanding.all?.goals?.against,
                form: homeStanding.form,
                description: homeStanding.description ?? null,
              } : null,
              away: awayStanding ? {
                position: awayStanding.rank,
                points: awayStanding.points,
                played: awayStanding.all?.played,
                won: awayStanding.all?.win,
                drawn: awayStanding.all?.draw,
                lost: awayStanding.all?.lose,
                goals_for: awayStanding.all?.goals?.for,
                goals_against: awayStanding.all?.goals?.against,
                form: awayStanding.form,
                description: awayStanding.description ?? null,
              } : null,
            },
            lineups: {
              home: homeLineup ? {
                formation: homeLineup.formation,
                coach: homeLineup.coach?.name,
                starters: homeLineup.startXI?.map((p: any) => `${p.player?.name} (${p.player?.pos})`),
              } : null,
              away: awayLineup ? {
                formation: awayLineup.formation,
                coach: awayLineup.coach?.name,
                starters: awayLineup.startXI?.map((p: any) => `${p.player?.name} (${p.player?.pos})`),
              } : null,
            },
            injuries: injuriesFormatted,
            fixture_stats: stats.length > 0 ? {
              home_shots_on: getTeamStat(homeId, 'Shots on Goal'),
              away_shots_on: getTeamStat(awayId, 'Shots on Goal'),
              home_corners: getTeamStat(homeId, 'Corner Kicks'),
              away_corners: getTeamStat(awayId, 'Corner Kicks'),
              home_possession: getTeamStat(homeId, 'Ball Possession'),
              away_possession: getTeamStat(awayId, 'Ball Possession'),
              home_yellow: getTeamStat(homeId, 'Yellow Cards'),
              away_yellow: getTeamStat(awayId, 'Yellow Cards'),
              home_saves: getTeamStat(homeId, 'Goalkeeper Saves'),
              away_saves: getTeamStat(awayId, 'Goalkeeper Saves'),
              home_shots_total: getTeamStat(homeId, 'Total Shots'),
              away_shots_total: getTeamStat(awayId, 'Total Shots'),
              home_fouls: getTeamStat(homeId, 'Fouls'),
              away_fouls: getTeamStat(awayId, 'Fouls'),
              home_offsides: getTeamStat(homeId, 'Offsides'),
              away_offsides: getTeamStat(awayId, 'Offsides'),
            } : null,
            h2h: {
              total: h2hRaw.length,
              home_wins: h2hHomeWins,
              draws: h2hDraws,
              away_wins: h2hAwayWins,
              avg_goals: h2hAvgGoals,
              list: h2hList,
            },
            home_season_stats_text: fmtSeasonStats(homeStats, fixture.teams.home.name, true),
            away_season_stats_text: fmtSeasonStats(awayStats, fixture.teams.away.name, false),
            home_form_list: homeFormList,
            away_form_list: awayFormList,
            odds: {
              bookmakers: oddsRaw.length,
              mw_home_avg: avgArr(mwHome),
              mw_draw_avg: avgArr(mwDraw),
              mw_away_avg: avgArr(mwAway),
              ou25_over_avg: avgArr(ou25Over),
              ou25_under_avg: avgArr(ou25Under),
            },
          },
        }
      } catch (err) {
        console.error('[avaliar] leg error:', err instanceof Error ? err.message : String(err))
        return { leg, data: null, reason: 'Erro ao buscar dados' }
      }
    })
  )

  // PASSO 3 — Montar texto completo com TODOS os dados reais
  const jogosTexto = legsWithData.map((item, i) => {
    const { leg, fixture, data } = item as any
    if (!data) return `JOGO ${i + 1}: ${leg.home_team} vs ${leg.away_team}\nSELEÇÃO: ${leg.selection} @ ${leg.odd}\n⚠️ Jogo não localizado na API para esta data.\n`

    const p = data.predictions
    const sh = data.standings.home
    const sa = data.standings.away
    const lh = data.lineups.home
    const la = data.lineups.away
    const inj = data.injuries
    const fs = data.fixture_stats
    const h2h = data.h2h
    const odds = data.odds

    return `
════════════════════════════════════════
JOGO ${i + 1}: ${fixture.home} vs ${fixture.away}
Liga: ${fixture.league} | Data: ${fixture.date?.split('T')[0]} | Status: ${fixture.status}
SELEÇÃO DO APOSTADOR: ${leg.selection} @ ${leg.odd}x
════════════════════════════════════════

PREVISÃO API (distribuição Poisson — dados reais):
${p ? `  Favorito: ${p.winner ?? 'N/D'}
  % Vitória casa: ${p.percent?.home ?? 'N/D'} | % Empate: ${p.percent?.draw ?? 'N/D'} | % Vitória fora: ${p.percent?.away ?? 'N/D'}
  Poisson: casa ${p.comparison?.poisson_distribution?.home ?? 'N/D'} | fora ${p.comparison?.poisson_distribution?.away ?? 'N/D'}
  Gols esperados: casa ${p.goals_home ?? 'N/D'} | fora ${p.goals_away ?? 'N/D'}
  Linha under/over: ${p.under_over ?? 'N/D'}
  Conselho da API: ${p.advice ?? 'N/D'}
  Força de ataque: casa ${p.comparison?.att?.home ?? 'N/D'} | fora ${p.comparison?.att?.away ?? 'N/D'}
  Força de defesa: casa ${p.comparison?.def?.home ?? 'N/D'} | fora ${p.comparison?.def?.away ?? 'N/D'}
  H2H histórico (API): casa ${p.comparison?.h2h?.home ?? 'N/D'} | fora ${p.comparison?.h2h?.away ?? 'N/D'}` : '  Previsão Poisson não disponível para este jogo.'}

POSIÇÃO NA TABELA (${fixture.league}):
${sh ? `  ${fixture.home}: ${sh.position}º | ${sh.points}pts | ${sh.played}J ${sh.won}V ${sh.drawn}E ${sh.lost}D | Gols: ${sh.goals_for} marc / ${sh.goals_against} sofr | Forma: ${sh.form ?? 'N/D'} | ${sh.description ?? ''}` : `  ${fixture.home}: dados de tabela não disponíveis`}
${sa ? `  ${fixture.away}: ${sa.position}º | ${sa.points}pts | ${sa.played}J ${sa.won}V ${sa.drawn}E ${sa.lost}D | Gols: ${sa.goals_for} marc / ${sa.goals_against} sofr | Forma: ${sa.form ?? 'N/D'} | ${sa.description ?? ''}` : `  ${fixture.away}: dados de tabela não disponíveis`}

ESTATÍSTICAS DA TEMPORADA:
${data.home_season_stats_text}
${data.away_season_stats_text}

HISTÓRICO DE CONFRONTOS DIRETOS (H2H — últimos ${h2h.total} jogos):
${h2h.total > 0 ? `  ${fixture.home} venceu: ${h2h.home_wins}x | Empates: ${h2h.draws}x | ${fixture.away} venceu: ${h2h.away_wins}x | Média de gols/jogo: ${h2h.avg_goals}
${h2h.list.join('\n')}` : '  Histórico H2H não disponível'}

FORMA RECENTE — ${fixture.home} (últimas 5 partidas):
${data.home_form_list.length > 0 ? data.home_form_list.join('\n') : '  Dados de forma não disponíveis'}

FORMA RECENTE — ${fixture.away} (últimas 5 partidas):
${data.away_form_list.length > 0 ? data.away_form_list.join('\n') : '  Dados de forma não disponíveis'}

ODDS DE MERCADO (${odds.bookmakers} casas de apostas):
${odds.bookmakers > 0 ? `  Match Winner — ${fixture.home}: ${odds.mw_home_avg} | Empate: ${odds.mw_draw_avg} | ${fixture.away}: ${odds.mw_away_avg}
  Over/Under 2.5 — Over: ${odds.ou25_over_avg} | Under: ${odds.ou25_under_avg}
  ODD DO APOSTADOR: ${leg.odd}x (${leg.selection})
  ${odds.mw_home_avg !== 'N/D' || odds.mw_draw_avg !== 'N/D' || odds.mw_away_avg !== 'N/D' ? '→ Compare a odd do apostador com a odd de mercado acima para detectar valor' : ''}` : '  Odds de mercado não disponíveis'}

ESCALAÇÃO CONFIRMADA:
${lh ? `  ${fixture.home} (${lh.formation}) | Técnico: ${lh.coach ?? 'N/D'}
  Titulares: ${lh.starters?.join(', ') ?? 'N/D'}` : `  ${fixture.home}: escalação não confirmada ainda`}
${la ? `  ${fixture.away} (${la.formation}) | Técnico: ${la.coach ?? 'N/D'}
  Titulares: ${la.starters?.join(', ') ?? 'N/D'}` : `  ${fixture.away}: escalação não confirmada ainda`}

DESFALQUES E LESÕES:
${inj.length > 0 ? inj.map((p: any) => `  ⛔ ${p.player} (${p.team}) — ${p.type}${p.reason ? `: ${p.reason}` : ''}`).join('\n') : '  Nenhum desfalque registrado na API'}

${fs ? `ESTATÍSTICAS DO JOGO (já aconteceu):
  Chutes a gol: ${fixture.home} ${fs.home_shots_on} | ${fixture.away} ${fs.away_shots_on}
  Total de chutes: ${fixture.home} ${fs.home_shots_total} | ${fixture.away} ${fs.away_shots_total}
  Escanteios: ${fixture.home} ${fs.home_corners} | ${fixture.away} ${fs.away_corners}
  Posse: ${fixture.home} ${fs.home_possession} | ${fixture.away} ${fs.away_possession}
  Cartões amarelos: ${fixture.home} ${fs.home_yellow} | ${fixture.away} ${fs.away_yellow}
  Defesas do goleiro: ${fixture.home} ${fs.home_saves} | ${fixture.away} ${fs.away_saves}
  Faltas: ${fixture.home} ${fs.home_fouls} | ${fixture.away} ${fs.away_fouls}
  Impedimentos: ${fixture.home} ${fs.home_offsides} | ${fixture.away} ${fs.away_offsides}` : ''}
`.trim()
  }).join('\n\n')

  const prompt = `Você é um analista esportivo especialista em apostas esportivas. Analise este bilhete múltiplo usando EXCLUSIVAMENTE os dados reais fornecidos abaixo.

⚠️ REGRA ABSOLUTA — NUNCA INVENTE DADOS:
- Use APENAS os números, percentuais e informações presentes nos blocos abaixo
- Se um campo aparecer como "N/D" ou "não disponível", mencione isso na justificativa
- NUNCA estime, interpole ou crie números que não estejam nos dados
- Se os dados forem insuficientes para uma análise, diga claramente "DADOS INSUFICIENTES"

COMO USAR OS DADOS:
- PREVISÃO API: usa distribuição Poisson para estimar gols esperados e probabilidades reais
- ESTATÍSTICAS DA TEMPORADA: revela padrão ofensivo/defensivo do time na temporada inteira
- H2H: histórico direto entre os times — pode contradizer a forma atual
- FORMA RECENTE: últimas 5 partidas com placar e adversário real
- ODDS DE MERCADO: compare a odd do apostador com o consenso do mercado — odd apostador > odd mercado pode indicar valor
- DESFALQUES: ausência de jogadores chave pode mudar completamente o prognóstico
- TABELA: contexto de pressão, zona de rebaixamento/classificação

BANCA DO APOSTADOR: R$ ${bankroll.toFixed(2)}
ODD TOTAL DO BILHETE: ${ticketData.total_odd ?? 'não identificada'}
VALOR APOSTADO: ${ticketData.stake ? `R$ ${ticketData.stake}` : 'não identificado'}
RETORNO POTENCIAL: ${ticketData.total_odd && ticketData.stake ? `R$ ${(ticketData.total_odd * ticketData.stake).toFixed(2)}` : 'não calculável'}

${jogosTexto}

Retorne APENAS este JSON (sem texto fora do JSON):
{
  "legs": [
    {
      "jogo": "Time A vs Time B",
      "selecao": "seleção do apostador",
      "odd": 1.80,
      "avaliacao": "FAVORÁVEL | NEUTRO | DESFAVORÁVEL | DADOS INSUFICIENTES",
      "confianca": "alta | média | baixa | sem dados",
      "justificativa": "3-4 frases usando dados REAIS — cite percentuais, posição na tabela, forma, H2H, desfalques. Se odds de mercado disponíveis, mencione se há valor.",
      "alerta": "alerta específico sobre desfalques críticos, forma ruim, H2H desfavorável ou odd sem valor — null se não houver",
      "valor_detectado": true
    }
  ],
  "resumo": {
    "jogos_favoraveis": 0,
    "jogos_neutros": 0,
    "jogos_desfavoraveis": 0,
    "jogos_sem_dados": 0,
    "probabilidade_estimada": "X% (produto das % individuais da API — só calcule se TODOS os jogos tiverem dados de predictions)",
    "odd_total": 8.50,
    "tem_valor": true,
    "nota_geral": "7/10",
    "parecer": "3-4 frases sobre a qualidade geral com base nos dados reais — mencione os pontos mais críticos"
  },
  "gestao_banca": {
    "stake_sugerido": 25.00,
    "percentual_banca": "7%",
    "raciocinio": "justificativa baseada na qualidade das seleções, odd total, risco da múltipla e banca disponível"
  },
  "alertas_gerais": ["alertas importantes sobre o bilhete como um todo — H2H contrariando o favorito, odd total muito alta, desfalques críticos, etc."]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Sem JSON na resposta')

    const analysis = JSON.parse(jsonMatch[0])

    if (!isPro) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('profiles').update({ avaliacoes_gratuitas: avaliacoesUsadas + 1 }).eq('id', user.id)
    }

    return NextResponse.json({ success: true, ticket: ticketData, analysis })
  } catch (err) {
    console.error('[bilhete/avaliar]', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Erro ao analisar bilhete. Tente novamente.' }, { status: 500 })
  }
}
