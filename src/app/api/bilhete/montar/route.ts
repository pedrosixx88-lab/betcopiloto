import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Schema = z.object({
  stake: z.number().positive(),
  fixture_ids: z.array(z.number()).min(1).max(8),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const { stake, fixture_ids } = parsed.data

  // Buscar histórico do usuário para padrões
  const { data: bets } = await supabase
    .from('bets')
    .select('market, selection, status, stake, odd')
    .eq('user_id', user.id)
    .in('status', ['won', 'lost'])
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<Array<{ market: string; selection: string; status: string; stake: number; odd: number }>>()

  // Garantir análises — gera as que ainda não existem no cache
  await Promise.all(
    fixture_ids.map(id =>
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/jogos/${id}/analisar`, {
        headers: { cookie: request.headers.get('cookie') ?? '' },
      }).catch(() => null)
    )
  )

  // Buscar análises dos jogos selecionados
  const { data: analyses } = await supabase
    .from('game_analyses')
    .select('fixture_id, home_team, away_team, league, summary')
    .in('fixture_id', fixture_ids)
    .returns<Array<{ fixture_id: number; home_team: string; away_team: string; league: string; summary: Record<string, unknown> }>>()

  if (!analyses || analyses.length === 0) {
    return NextResponse.json({ error: 'Não foi possível analisar os jogos. Tente novamente.' }, { status: 400 })
  }

  // Calcular padrões do usuário por mercado
  const marketStats: Record<string, { won: number; total: number }> = {}
  for (const bet of bets ?? []) {
    if (!marketStats[bet.market]) marketStats[bet.market] = { won: 0, total: 0 }
    marketStats[bet.market].total++
    if (bet.status === 'won') marketStats[bet.market].won++
  }

  const patternText = Object.entries(marketStats)
    .map(([m, s]) => `${m}: ${((s.won / s.total) * 100).toFixed(0)}% win rate (${s.total} apostas)`)
    .join('\n') || 'Sem histórico suficiente.'

  const gamesText = analyses.map(a => {
    const summary = a.summary as { tip?: string; confidence?: string; markets?: Array<{ market: string; selection: string; reasoning: string; confidence: string; odd?: string | null }> }
    const markets = summary?.markets?.map(m => {
      const oddInfo = m.odd ? ` [odd real: ${m.odd}]` : ''
      return `  - ${m.market}: ${m.selection} (${m.confidence})${oddInfo} — ${m.reasoning}`
    }).join('\n') ?? ''
    return `${a.home_team} vs ${a.away_team} (${a.league}):\n  Tip principal: ${summary?.tip ?? 'N/A'}\n  Confiança: ${summary?.confidence ?? 'N/A'}\n${markets}`
  }).join('\n\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Você é um montador de bilhetes esportivos especialista em gestão de banca.

VALOR DISPONÍVEL: R$ ${stake.toFixed(2)}

HISTÓRICO DO APOSTADOR (win rate por mercado):
${patternText}

ANÁLISES DOS JOGOS SELECIONADOS:
${gamesText}

Monte um bilhete otimizado em JSON com o seguinte formato EXATO:
{
  "selections": [
    {
      "fixture_id": 123,
      "home_team": "...",
      "away_team": "...",
      "market": "match_winner | over_under | both_teams_score | corners | cards",
      "selection": "descrição da seleção",
      "reasoning": "justificativa em 1 frase com dados reais",
      "odd": "odd real do mercado se disponível, ou null"
    }
  ],
  "stake_suggested": 50.00,
  "confidence": "alta | média | baixa",
  "alerts": ["alerta se detectar padrão negativo do apostador, ex: 'Você tem apenas 30% de win rate em Over/Under'"]
}

Regras:
- Máximo 4 seleções no bilhete
- Prefira mercados onde o apostador tem melhor win rate e onde há odds reais disponíveis
- Se detectar mercado com win rate < 40%, adicione alerta em "alerts"
- Inclua a odd real quando disponível na análise (campo "odd real" acima)
- NÃO invente odds — use apenas as que estão explicitamente marcadas como "odd real" nos dados
- Sempre justifique cada seleção com dados reais`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Resposta inválida')

    const ticket = JSON.parse(jsonMatch[0])
    return NextResponse.json({ success: true, ticket })
  } catch {
    return NextResponse.json({ error: 'Erro ao montar bilhete. Tente novamente.' }, { status: 500 })
  }
}
