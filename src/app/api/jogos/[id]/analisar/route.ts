import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFixtureById, getH2H, getLastMatches, getStandings, getTeamSeasonStats } from '@/lib/api-football'

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
  return matches.map(f => {
    const isHome = f.teams.home.name === teamName || f.teams.home.name.includes(teamName.split(' ')[0])
    const hg = f.score?.fulltime?.home ?? f.goals?.home ?? '?'
    const ag = f.score?.fulltime?.away ?? f.goals?.away ?? '?'
    const status = f.fixture.status.short
    if (!['FT','AET','PEN'].includes(status)) return null
    let result = '?'
    if (typeof hg === 'number' && typeof ag === 'number') {
      result = isHome ? (hg > ag ? 'V' : hg === ag ? 'E' : 'D') : (ag > hg ? 'V' : ag === hg ? 'E' : 'D')
    }
    const date = new Date(f.fixture.date).toLocaleDateString('pt-BR')
    const opp = isHome ? f.teams.away.name : f.teams.home.name
    return `  ${result} | ${date} vs ${opp} (${hg}x${ag}) [${f.league.name}]`
  }).filter(Boolean).join('\n') || `Sem resultados finalizados recentes para ${teamName}.`
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

  // Cache válido = existe e tip não é "Indisponível"
  const { data: cached } = await supabase
    .from('game_analyses')
    .select('analysis, summary, home_team, away_team, league, created_at')
    .eq('fixture_id', fixtureId)
    .single<{ analysis: string; summary: any; home_team: string; away_team: string; league: string; created_at: string }>()

  const cacheValid = cached && cached.summary?.tip && cached.summary.tip !== 'Indisponível'
  if (cacheValid) {
    const { created_at: _, ...rest } = cached
    return NextResponse.json({ success: true, cached: true, ...rest })
  }

  // Buscar dados do jogo
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

  // Buscar tudo em paralelo
  const [h2h, homeLast, awayLast, standings, homeStats, awayStats] = await Promise.all([
    getH2H(homeId, awayId).catch(() => []),
    getLastMatches(homeId, 6).catch(() => []),
    getLastMatches(awayId, 6).catch(() => []),
    getStandings(leagueId, SEASON).catch(() => []),
    getTeamSeasonStats(homeId, leagueId, SEASON).catch(() => null),
    getTeamSeasonStats(awayId, leagueId, SEASON).catch(() => null),
  ])

  // Formatar contexto
  const h2hText = h2h.length
    ? h2h.map(formatMatch).join('\n')
    : 'Sem confrontos diretos recentes disponíveis.'

  const standingsFlat = standings.flatMap((s: any) =>
    Array.isArray(s?.league?.standings) ? s.league.standings.flat() : []
  )

  const homeStanding = formatStandings(standingsFlat, homeId)
  const awayStanding = formatStandings(standingsFlat, awayId)
  const homeLastText = formatLastMatches(homeLast, homeTeam)
  const awayLastText = formatLastMatches(awayLast, awayTeam)
  const homeStatsText = formatStats(homeStats, homeTeam)
  const awayStatsText = formatStats(awayStats, awayTeam)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Você é um analista esportivo especialista em apostas. Analise o jogo com os dados REAIS abaixo e retorne APENAS JSON válido.

═══════════════════════════════
JOGO: ${homeTeam} vs ${awayTeam}
COMPETIÇÃO: ${league} — ${round}
DATA: ${matchDate}
═══════════════════════════════

CLASSIFICAÇÃO ATUAL NA COMPETIÇÃO:
${homeTeam}: ${homeStanding}
${awayTeam}: ${awayStanding}

ÚLTIMAS PARTIDAS — ${homeTeam}:
${homeLastText}

ÚLTIMAS PARTIDAS — ${awayTeam}:
${awayLastText}

ESTATÍSTICAS NA TEMPORADA ${SEASON}:
${homeTeam}: ${homeStatsText}
${awayTeam}: ${awayStatsText}

HISTÓRICO DE CONFRONTOS DIRETOS (H2H — últimos jogos):
${h2hText}

Com base NESSES DADOS REAIS, forneça análise precisa. Mencione explicitamente a posição na tabela, a forma recente e os dados H2H. Retorne exatamente este JSON sem texto fora:
{
  "analysis": "Análise em 4 parágrafos em português: 1) contexto e posição na competição, 2) forma recente de cada time com números reais, 3) histórico H2H e padrões, 4) conclusão e recomendação principal.",
  "summary": {
    "tip": "Tip principal baseada nos dados (ex: 'Vitória do ${homeTeam}', 'Under 2.5 gols')",
    "confidence": "alta | média | baixa",
    "markets": [
      { "market": "match_winner", "selection": "...", "reasoning": "justificativa com dados reais", "confidence": "alta | média | baixa" },
      { "market": "over_under", "selection": "Over ou Under X.X gols", "reasoning": "justificativa com dados reais", "confidence": "alta | média | baixa" },
      { "market": "both_teams_score", "selection": "Sim ou Não", "reasoning": "justificativa com dados reais", "confidence": "alta | média | baixa" }
    ]
  }
}`

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

  // Salvar cache
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
