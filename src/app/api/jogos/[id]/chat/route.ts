import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { message, history } = await request.json() as {
    message: string
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  if (!message) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  // Buscar análise em cache
  const { data: cached } = await supabase
    .from('game_analyses')
    .select('analysis, home_team, away_team, league')
    .eq('fixture_id', parseInt(id))
    .single<{ analysis: string; home_team: string; away_team: string; league: string }>()

  const context = cached
    ? `Jogo: ${cached.home_team} vs ${cached.away_team} (${cached.league})\n\nAnálise prévia:\n${cached.analysis}`
    : `Jogo ID: ${id}`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: `Você é um analista esportivo especialista em apostas. Responda perguntas sobre o seguinte jogo de forma direta e objetiva em português brasileiro. Máximo 3 parágrafos curtos.\n\n${context}`,
    messages,
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ success: true, reply })
}
