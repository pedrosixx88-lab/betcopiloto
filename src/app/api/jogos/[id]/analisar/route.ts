import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getFixtureById, getH2H, getLastMatches, getStandings,
  getTeamSeasonStats, getFixtureOdds, getFixtureStats,
} from '@/lib/api-football'

const SEASON = 2026

function formatMatch(f: any): string {
  const hg = f.score?.fulltime?.home ?? f.goals?.home ?? '?'
  const ag = f.score?.fulltime?.away ?? f.goals?.away ?? '?'
  const date = new Date(f.fixture.date).toLocaleDateString('pt-BR')
  const status = f.fixture.status.short
  const live = ['1H','2H','HT','ET'].includes(status) ? ' (em andamento)' : ''
  return `${date}: ${f.teams.home.name} ${hg} x ${ag} ${f.teams.away.name} [${f.league.name}]${live}`
}

function formatLastMatches(matches: any[], teamName: string): string {
  if (!matches.length) return `Sem dados de partidas recentes para ${teamName}.`
  const finished = matches.filter(f => ['FT','AET','PEN'].includes(f.fixture.status.short))
  if (!finished.length) return `Sem resultados finalizados recentes para ${teamName}.`
  return finished.map(f => {
    const isHome = f.teams.home.name === teamName || f.teams.home.name.includes(teamName.split(' ')[0])
    const hg = f.score?.fulltime?.home ?? f.goals?.home ?? '?'
    const ag = f.score?.fulltime?.away ?? f.goals?.away ?? '?'
    let result = '?'
    if (typeof hg === 'number' && typeof ag === 'number') {
      result = isHome ? (hg > ag ? 'V' : hg === ag ? 'E' : 'D') : (ag > hg ? 'V' : ag === hg ? 'E' : 'D')
    }
    const date = new Date(f.fixture.date).toLocaleDateString('pt-BR')
    const opp = isHome ? f.teams.away.name : f.teams.home.name
    return `  ${result} | ${date} vs ${opp} (${hg}x${ag}) [${f.league.name}]`
  }).join('\n')
}

function formatStandings(standings: any[], teamId: number): string {
  for (const group of standings) {
    const arr = Array.isArray(group) ? group : [group]
    for (const entry of arr) {
      if (entry.team?.id === teamId) {
        const g = entry.group ? ` — ${entry.group}` : ''
        return `${entry.rank}º lugar${g} | ${entry.points} pts | ${entry.all?.played ?? 0} jogos | ${entry.all?.win ?? 0}V ${entry.all?.draw ?? 0}E ${entry.all?.lose ?? 0}D | Gols: ${entry.all?.goals?.for ?? 0} marcados, ${entry.all?.goals?.against ?? 0} sofridos`
      }
    }
  }
  return 'Classificação não disponível.'
}

function formatStats(stats: any, teamName: string): string {
  if (!stats || !stats.fixtures) return `Sem estatísticas da temporada para ${teamName}.`
  const f = stats.fixtures
  const g = stats.goals
  const played = f.played?.total ?? 0
  const wins = f.wins?.total ?? 0
  const draws = f.draws?.total ?? 0
  const loses = f.loses?.total ?? 0
  const goalsFor = g?.for?.total?.total ?? 0
  const goalsAgainst = g?.against?.total?.total ?? 0
  const avgFor = g?.for?.average?.total ?? '?'
  const avgAgainst = g?.against?.average?.total ?? '?'
  const form = stats.form ?? 'N/D'
  return `${played} jogos: ${wins}V ${draws}E ${loses}D | Gols: ${goalsFor} marcados (média ${avgFor}/jogo), ${goalsAgainst} sofridos (média ${avgAgainst}/jogo) | Forma recente: ${form.slice(-5)}`
}

function extractOdds(oddsData: any[]): {
  matchWinner: { home: string; draw: string; away: string } | null
  overUnder: { line: string; over: string; under: string } | null
  btts: { yes: string; no: string } | null
  corners: { line: string; over: string; under: string } | null
  cards: { line: string; over: string; under: string } | null
  bookmaker: string
} {
  const result = { matchWinner: null as any, overUnder: null as any, btts: null as any, corners: null as any, cards: null as any, bookmaker: '' }
  if (!oddsData?.length) return result

  // Estrutura: response[0].bookmakers[]. Prioriza Bet365 (id=8), fallback para o primeiro disponível
  const fixtureOdds = oddsData[0]
  const bookmakers = fixtureOdds?.bookmakers ?? []
  const bk = bookmakers.find((b: any) => b.id === 8) ?? bookmakers[0]
  if (!bk) return result
  result.bookmaker = bk?.name ?? 'Bookmaker'

  for (const bet of bk?.bets ?? []) {
    const name = (bet.name ?? '').toLowerCase()

    if (!result.matchWinner && (name.includes('match winner') || name === '3way result')) {
      const home = bet.values?.find((v: any) => v.value === 'Home')?.odd ?? null
      const draw = bet.values?.find((v: any) => v.value === 'Draw')?.odd ?? null
      const away = bet.values?.find((v: any) => v.value === 'Away')?.odd ?? null
      if (home && draw && away) result.matchWinner = { home, draw, away }
    }

    if (!result.overUnder && name.includes('goals over/under')) {
      const over25 = bet.values?.find((v: any) => v.value === 'Over 2.5')
      const under25 = bet.values?.find((v: any) => v.value === 'Under 2.5')
      if (over25 && under25) result.overUnder = { line: '2.5', over: over25.odd, under: under25.odd }
      else {
        const firstOver = bet.values?.find((v: any) => (v.value ?? '').toLowerCase().startsWith('over'))
        const firstUnder = bet.values?.find((v: any) => (v.value ?? '').toLowerCase().startsWith('under'))
        if (firstOver && firstUnder) {
          const line = (firstOver.value ?? '').replace(/over\s*/i, '')
          result.overUnder = { line, over: firstOver.odd, under: firstUnder.odd }
        }
      }
    }

    if (!result.btts && (name.includes('both teams score') || name.includes('btts'))) {
      const yes = bet.values?.find((v: any) => (v.value ?? '').toLowerCase() === 'yes')?.odd ?? null
      const no = bet.values?.find((v: any) => (v.value ?? '').toLowerCase() === 'no')?.odd ?? null
      if (yes && no) result.btts = { yes, no }
    }

    // "Corners Over Under" (sem barra) — busca Over 8.5 ou Over 9.5
    if (!result.corners && name === 'corners over under') {
      const over85 = bet.values?.find((v: any) => v.value === 'Over 8.5')
      const under85 = bet.values?.find((v: any) => v.value === 'Under 8.5')
      if (over85 && under85) {
        result.corners = { line: '8.5', over: over85.odd, under: under85.odd }
      } else {
        const firstOver = bet.values?.find((v: any) => (v.value ?? '').toLowerCase().startsWith('over'))
        const firstUnder = bet.values?.find((v: any) => (v.value ?? '').toLowerCase().startsWith('under'))
        if (firstOver && firstUnder) {
          const line = (firstOver.value ?? '').replace(/over\s*/i, '')
          result.corners = { line, over: firstOver.odd, under: firstUnder.odd }
        }
      }
    }

    // "Cards Over/Under" (com barra) — busca Over 4.5 ou Over 5.5
    if (!result.cards && name === 'cards over/under') {
      const over45 = bet.values?.find((v: any) => v.value === 'Over 4.5')
      const under45 = bet.values?.find((v: any) => v.value === 'Under 4.5')
      if (over45 && under45) {
        result.cards = { line: '4.5', over: over45.odd, under: under45.odd }
      } else {
        const firstOver = bet.values?.find((v: any) => (v.value ?? '').toLowerCase().startsWith('over'))
        const firstUnder = bet.values?.find((v: any) => (v.value ?? '').toLowerCase().startsWith('under'))
        if (firstOver && firstUnder) {
          const line = (firstOver.value ?? '').replace(/over\s*/i, '')
          result.cards = { line, over: firstOver.odd, under: firstUnder.odd }
        }
      }
    }
  }

  return result
}

function avgStat(fixtureStats: any[][], statName: string): number | null {
  const values: number[] = []
  for (const stats of fixtureStats) {
    let total = 0
    for (const teamStat of stats) {
      const found = teamStat.statistics?.find((s: any) =>
        (s.type ?? '').toLowerCase().includes(statName.toLowerCase())
      )
      if (found?.value != null && typeof found.value === 'number') total += found.value
    }
    if (total > 0) values.push(total)
  }
  if (!values.length) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const fixtureId = parseInt(id)
  if (isNaN(fixtureId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'

  const { data: cached } = await supabase
    .from('game_analyses')
    .select('analysis, summary, home_team, away_team, league, created_at')
    .eq('fixture_id', fixtureId)
    .single<{ analysis: string; summary: any; home_team: string; away_team: string; league: string; created_at: string }>()

  const cacheValid = !forceRefresh && cached && cached.summary?.tip && cached.summary.tip !== 'Indisponível'
  if (cacheValid) {
    const { created_at: _, ...rest } = cached
    return NextResponse.json({ success: true, cached: true, ...rest })
  }

  const fixture = await getFixtureById(fixtureId)
  if (!fixture) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })

  const homeId = fixture.teams.home.id
  const awayId = fixture.teams.away.id
  const leagueId = fixture.league.id
  const homeTeam = fixture.teams.home.name
  const awayTeam = fixture.teams.away.name
  const league = fixture.league.name
  const round = fixture.league.round ?? ''
  const matchDate = new Date(fixture.fixture.date).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const [h2h, homeLast, awayLast, standings, homeStats, awayStats, oddsData] = await Promise.all([
    getH2H(homeId, awayId).catch(() => []),
    getLastMatches(homeId, 7).catch(() => []),
    getLastMatches(awayId, 7).catch(() => []),
    getStandings(leagueId, SEASON).catch(() => []),
    getTeamSeasonStats(homeId, leagueId, SEASON).catch(() => null),
    getTeamSeasonStats(awayId, leagueId, SEASON).catch(() => null),
    getFixtureOdds(fixtureId).catch(() => []),
  ])

  // Estatísticas dos últimos H2H para médias de escanteios e cartões
  const h2hFinished = h2h.filter((f: any) => ['FT','AET','PEN'].includes(f.fixture.status.short)).slice(0, 3)
  const h2hStats = await Promise.all(
    h2hFinished.map((f: any) => getFixtureStats(f.fixture.id).catch(() => []))
  )

  const avgCorners = avgStat(h2hStats, 'corner')
  const avgCards = avgStat(h2hStats, 'yellow card')

  const odds = extractOdds(oddsData)

  const standingsFlat = standings.flatMap((s: any) =>
    Array.isArray(s?.league?.standings) ? s.league.standings.flat() : []
  )

  const homeStanding = formatStandings(standingsFlat, homeId)
  const awayStanding = formatStandings(standingsFlat, awayId)
  const homeLastText = formatLastMatches(homeLast, homeTeam)
  const awayLastText = formatLastMatches(awayLast, awayTeam)
  const homeStatsText = formatStats(homeStats, homeTeam)
  const awayStatsText = formatStats(awayStats, awayTeam)
  const h2hText = h2h.length ? h2h.map(formatMatch).join('\n') : 'Sem confrontos diretos recentes.'

  const oddsText = odds.bookmaker ? `
ODDS REAIS (${odds.bookmaker}):
${odds.matchWinner ? `• Match Winner: Casa ${odds.matchWinner.home} | Empate ${odds.matchWinner.draw} | Fora ${odds.matchWinner.away}` : '• Match Winner: não disponível'}
${odds.overUnder ? `• Gols Over/Under ${odds.overUnder.line}: Over ${odds.overUnder.over} | Under ${odds.overUnder.under}` : '• Gols Over/Under: não disponível'}
${odds.btts ? `• Ambas marcam: Sim ${odds.btts.yes} | Não ${odds.btts.no}` : '• Ambas marcam: não disponível'}
${odds.corners ? `• Escanteios Over/Under ${odds.corners.line}: Over ${odds.corners.over} | Under ${odds.corners.under}` : '• Escanteios: não disponível'}
${odds.cards ? `• Cartões Over/Under ${odds.cards.line}: Over ${odds.cards.over} | Under ${odds.cards.under}` : '• Cartões: não disponível'}
` : 'ODDS REAIS: não disponíveis para este jogo.'

  const cornersCardsText = `
MÉDIAS H2H (${h2hFinished.length} jogos analisados):
• Média de escanteios por jogo: ${avgCorners !== null ? avgCorners : 'sem dados'}
• Média de cartões amarelos por jogo: ${avgCards !== null ? avgCards : 'sem dados'}
`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Opções de mercado para o prompt — texto simples sem aspas aninhadas
  const mwOpts = odds.matchWinner
    ? `Casa: ${odds.matchWinner.home} | Empate: ${odds.matchWinner.draw} | Fora: ${odds.matchWinner.away}`
    : 'odds não disponíveis'
  const ouOpts = odds.overUnder
    ? `Over ${odds.overUnder.line}: ${odds.overUnder.over} | Under ${odds.overUnder.line}: ${odds.overUnder.under}`
    : 'Over 2.5 ou Under 2.5 (odds não disponíveis)'
  const bttsOpts = odds.btts
    ? `Sim: ${odds.btts.yes} | Não: ${odds.btts.no}`
    : 'Sim ou Não (odds não disponíveis)'
  const cornerOpts = odds.corners
    ? `Over ${odds.corners.line}: ${odds.corners.over} | Under ${odds.corners.line}: ${odds.corners.under}`
    : avgCorners !== null ? `média H2H é ${avgCorners} escanteios` : null
  const cardOpts = odds.cards
    ? `Over ${odds.cards.line}: ${odds.cards.over} | Under ${odds.cards.line}: ${odds.cards.under}`
    : avgCards !== null ? `média H2H é ${avgCards} cartões` : null

  const cornersBlock = cornerOpts ? `\nMercado Escanteios — opções: ${cornerOpts}` : ''
  const cardsBlock = cardOpts ? `\nMercado Cartões — opções: ${cardOpts}` : ''

  const prompt = `Você é um analista esportivo especialista em apostas. Sua função é analisar jogos com base EXCLUSIVAMENTE nos dados fornecidos abaixo.

JOGO: ${homeTeam} vs ${awayTeam}
COMPETIÇÃO: ${league} — ${round} | DATA: ${matchDate} | TEMPORADA: ${SEASON}

CLASSIFICAÇÃO ATUAL NA COMPETIÇÃO (${league}):
${homeTeam}: ${homeStanding}
${awayTeam}: ${awayStanding}

ÚLTIMAS 7 PARTIDAS — ${homeTeam}:
${homeLastText}

ÚLTIMAS 7 PARTIDAS — ${awayTeam}:
${awayLastText}

ESTATÍSTICAS NA TEMPORADA ${SEASON} (nesta competição):
${homeTeam}: ${homeStatsText}
${awayTeam}: ${awayStatsText}

CONFRONTOS DIRETOS H2H:
${h2hText}
${cornersCardsText}
${oddsText}

OPÇÕES DE ODDS DISPONÍVEIS (Bet365):
Mercado 1X2 — opções: ${mwOpts}
Mercado Gols Over/Under — opções: ${ouOpts}
Mercado Ambas Marcam — opções: ${bttsOpts}${cornersBlock}${cardsBlock}

════════════════════════════════════════
REGRAS ABSOLUTAS — VIOLÁ-LAS É INACEITÁVEL:

[INTEGRIDADE DOS DADOS]
1. NUNCA invente números, percentuais ou estatísticas. Use APENAS os números exatos fornecidos acima.
2. Se um dado não estiver nos dados fornecidos, NÃO mencione — diga "sem dados suficientes" se necessário.
3. NUNCA afirme algo como "o time não perdeu nos últimos X jogos" a menos que os resultados acima comprovem isso.
4. Todo número citado na análise deve ser rastreável nos dados acima.

[CONTEXTO DO CAMPEONATO]
5. A análise deve levar em conta o campeonato específico: fase (grupos, mata-mata), rodada, o que está em jogo para cada time (classificação, eliminação, etc).
6. A posição na tabela DESTA competição tem mais peso que forma geral — um time líder com folga joga diferente de um time que precisa vencer para não ser eliminado.
7. H2H nesta mesma competição vale mais que H2H em competições diferentes.

[CONSISTÊNCIA LÓGICA]
8. Under 2.5 gols + Ambas marcam Sim = PROIBIDO (placar 1x1 é muito específico para recomendar os dois juntos).
9. Escolha APENAS UMA direção por mercado (Over OU Under, Sim OU Não — nunca ambos).
10. Todos os mercados devem contar a mesma história coerente sobre o jogo.

[FORMATO]
11. A odd no JSON deve ser um número (ex: 2.35), não string. Se não disponível, use null.
════════════════════════════════════════

Retorne APENAS o JSON abaixo, sem nenhum texto fora dele:
{
  "analysis": "5 parágrafos em português citando APENAS dados fornecidos acima: 1) contexto do campeonato e posição na tabela com números exatos, 2) forma recente de cada time com resultados reais listados, 3) H2H com resultados reais e o que indicam, 4) escanteios e cartões com as médias fornecidas, 5) conclusão coerente com tudo acima",
  "summary": {
    "tip": "tip principal baseada nos dados — ex: Vitória do ${homeTeam} ou Under 2.5 gols",
    "confidence": "alta ou média ou baixa",
    "markets": [
      { "market": "match_winner", "selection": "Vitória do X ou Empate ou Vitória do Y", "reasoning": "cite o dado exato que embasa — ex: lidera com 10pts, 3V 1E 0D", "confidence": "alta", "odd": 1.85 },
      { "market": "over_under", "selection": "Over X.X gols ou Under X.X gols", "reasoning": "cite médias de gols reais dos dados", "confidence": "média", "odd": 2.35 },
      { "market": "both_teams_score", "selection": "Sim ou Não", "reasoning": "consistente com over/under escolhido acima", "confidence": "média", "odd": 1.50 }
    ]
  }
}

Se houver dados de escanteios ou cartões, adicione esses mercados no array. A odd deve ser número, não string.`

  let analysis = ''
  let summary: Record<string, unknown> = {}

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON não encontrado na resposta')

    const parsed = JSON.parse(jsonMatch[0])
    analysis = parsed.analysis ?? ''
    summary = parsed.summary ?? {}
    if (!analysis || !(summary as any).tip) throw new Error('Campos obrigatórios vazios')
  } catch (err) {
    console.error('Erro análise IA:', err)
    return NextResponse.json({ error: 'Erro ao gerar análise' }, { status: 500 })
  }

  const admin = createAdminClient()
  await (admin as any).from('game_analyses').upsert({
    fixture_id: fixtureId,
    home_team: homeTeam,
    away_team: awayTeam,
    league,
    match_date: fixture.fixture.date.split('T')[0],
    analysis,
    summary,
  }, { onConflict: 'fixture_id' })

  return NextResponse.json({ success: true, cached: false, analysis, summary, home_team: homeTeam, away_team: awayTeam, league })
}
