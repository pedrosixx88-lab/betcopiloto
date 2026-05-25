import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // 20 mensagens por usuário a cada 5 minutos
  if (!rateLimit(`chat:${user.id}`, 20, 5 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas mensagens. Aguarde alguns minutos.' }, { status: 429 })
  }

  const { id } = await params
  const fixtureId = parseInt(id)
  if (!isFinite(fixtureId) || isNaN(fixtureId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await request.json() as {
    message: string
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  const message = typeof body.message === 'string' ? body.message.slice(0, 1000) : ''
  if (!message.trim()) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  const rawHistory = Array.isArray(body.history) ? body.history : []
  const history = rawHistory
    .filter(h => (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
    .slice(-10)
    .map(h => ({ role: h.role, content: String(h.content).slice(0, 2000) }))

  const { data: cached } = await supabase
    .from('game_analyses')
    .select('analysis, summary, home_team, away_team, league')
    .eq('fixture_id', fixtureId)
    .single<{ analysis: string; summary: any; home_team: string; away_team: string; league: string }>()

  const gameContext = cached
    ? `JOGO: ${cached.home_team} vs ${cached.away_team}
COMPETIÇÃO: ${cached.league}

ANÁLISE COMPLETA:
${cached.analysis}

TIP PRINCIPAL: ${cached.summary?.tip ?? 'N/A'} (confiança: ${cached.summary?.confidence ?? 'N/A'})

MERCADOS ANALISADOS:
${cached.summary?.markets?.map((m: any) => `- ${m.market}: ${m.selection}${m.odd ? ` @ ${m.odd}` : ''} — ${m.reasoning}`).join('\n') ?? 'N/A'}`
    : `Jogo ID: ${id} — análise ainda não gerada.`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  const system = `Você é um assistente especializado EXCLUSIVAMENTE em análise esportiva e apostas para o jogo abaixo. Suas respostas devem:

1. SOMENTE abordar temas relacionados a este jogo específico, apostas esportivas, mercados, odds ou estratégias de banca
2. Se o usuário perguntar sobre qualquer outro assunto (política, tecnologia, receitas, etc.), responda: "Só posso te ajudar com análises e apostas deste jogo."
3. Basear-se nos dados reais da análise abaixo — não invente estatísticas
4. Ser direto e objetivo — máximo 3 parágrafos curtos
5. Responder sempre em português brasileiro

${gameContext}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system,
    messages,
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ success: true, reply })
}
