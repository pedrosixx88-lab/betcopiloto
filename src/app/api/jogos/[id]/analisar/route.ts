import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFixtureById, getH2H } from '@/lib/api-football'

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

  // Verificar cache
  const { data: cached } = await supabase
    .from('game_analyses')
    .select('analysis, summary, home_team, away_team, league')
    .eq('fixture_id', fixtureId)
    .single<{ analysis: string; summary: Record<string, unknown>; home_team: string; away_team: string; league: string }>()

  if (cached) {
    return NextResponse.json({ success: true, cached: true, ...cached })
  }

  // Buscar dados do jogo
  const fixture = await getFixtureById(fixtureId)
  if (!fixture) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })

  // Buscar H2H
  let h2hText = 'Dados H2H não disponíveis.'
  try {
    const h2h = await getH2H(fixture.teams.home.id, fixture.teams.away.id)
    if (h2h.length > 0) {
      h2hText = h2h.map(f => {
        const hg = f.score.fulltime.home ?? f.goals.home ?? '?'
        const ag = f.score.fulltime.away ?? f.goals.away ?? '?'
        const date = new Date(f.fixture.date).toLocaleDateString('pt-BR')
        return `${date}: ${f.teams.home.name} ${hg} x ${ag} ${f.teams.away.name}`
      }).join('\n')
    }
  } catch { /* ignora erro de H2H */ }

  const homeTeam = fixture.teams.home.name
  const awayTeam = fixture.teams.away.name
  const league = fixture.league.name
  const matchDate = new Date(fixture.fixture.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Gerar análise com Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Você é um analista esportivo especialista em apostas esportivas. Analise o seguinte jogo e forneça uma análise detalhada para apostadores.

JOGO: ${homeTeam} vs ${awayTeam}
LIGA: ${league}
DATA: ${matchDate}

HISTÓRICO RECENTE (H2H - últimos 5 confrontos):
${h2hText}

Forneça sua análise em JSON com o seguinte formato EXATO (sem texto fora do JSON):
{
  "analysis": "Análise completa em português, 3-4 parágrafos cobrindo: forma recente dos times, histórico H2H, contexto da liga, principais fatores que influenciam o jogo, mercados mais interessantes.",
  "summary": {
    "tip": "Seleção recomendada principal (ex: 'Vitória do ${homeTeam}', 'Over 2.5 gols', 'Ambas marcam - Sim')",
    "confidence": "alta | média | baixa",
    "markets": [
      { "market": "match_winner", "selection": "...", "reasoning": "...", "confidence": "alta | média | baixa" },
      { "market": "over_under", "selection": "...", "reasoning": "...", "confidence": "alta | média | baixa" },
      { "market": "both_teams_score", "selection": "...", "reasoning": "...", "confidence": "alta | média | baixa" }
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
    if (!jsonMatch) throw new Error('Resposta inválida')

    const parsed = JSON.parse(jsonMatch[0])
    analysis = parsed.analysis ?? ''
    summary = parsed.summary ?? {}
  } catch {
    analysis = `Análise automática indisponível para ${homeTeam} vs ${awayTeam}. Verifique as últimas notícias sobre os times antes de apostar.`
    summary = { tip: 'Indisponível', confidence: 'baixa', markets: [] }
  }

  // Salvar no cache (admin para bypassar RLS)
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
