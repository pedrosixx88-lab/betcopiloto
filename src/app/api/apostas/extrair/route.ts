import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const BetExtractionSchema = z.object({
  // Para bilhetes simples: times do jogo
  home_team: z.string(),
  away_team: z.string(),
  league: z.string().nullable(),
  market: z.enum(['match_winner', 'over_under', 'both_teams_score', 'handicap', 'correct_score', 'other']),
  selection: z.string(),
  odd: z.number().nonnegative(),
  stake: z.number().nonnegative(),
  potential_return: z.number().nonnegative(),
  match_date: z.string(),
  bookmaker: z.string().nullable(),
  // Campos extras para bilhetes múltiplos
  is_multiple: z.boolean().optional(),
  legs: z.array(z.object({
    home_team: z.string(),
    away_team: z.string(),
    selection: z.string(),
    odd: z.number(),
    market: z.string(),
  })).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // 5 extrações por usuário a cada 5 minutos
  if (!rateLimit(`extrair:${user.id}`, 5, 5 * 60 * 1000)) {
    return NextResponse.json({ error: 'Muitas requisições. Aguarde alguns minutos.' }, { status: 429 })
  }

  const formData = await request.formData()
  const file = formData.get('screenshot') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Imagem muito grande. Máximo 10MB.' }, { status: 400 })
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Formato inválido. Use JPG, PNG ou WebP.' }, { status: 400 })
  }

  // Upload para Supabase Storage
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.type.split('/')[1]
  const path = `${user.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('bet-screenshots')
    .upload(path, buffer, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: 'Erro ao fazer upload da imagem.' }, { status: 500 })
  }

  const { data: signedData } = await supabase.storage
    .from('bet-screenshots')
    .createSignedUrl(path, 3600)
  const signedUrl = signedData?.signedUrl ?? null

  // Extração com Claude Vision
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let extracted: z.infer<typeof BetExtractionSchema>

  try {
    const base64 = buffer.toString('base64')
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Analise este print de bilhete de aposta esportiva e extraia as informações em JSON.

O bilhete pode ser simples (1 jogo) ou múltiplo/combinado (vários jogos).

Retorne APENAS o JSON, sem texto adicional:

Para bilhete SIMPLES (1 jogo):
{
  "is_multiple": false,
  "home_team": "nome do time da casa",
  "away_team": "nome do time visitante",
  "league": "nome da liga ou null",
  "market": "match_winner | over_under | both_teams_score | handicap | correct_score | other",
  "selection": "descrição da seleção (ex: 'Flamengo', 'Over 2.5', 'Ambas marcam')",
  "odd": 1.85,
  "stake": 50.00,
  "potential_return": 92.50,
  "match_date": "YYYY-MM-DD",
  "bookmaker": "nome da casa ou null"
}

Para bilhete MÚLTIPLO/COMBINADO (2+ jogos):
{
  "is_multiple": true,
  "home_team": "Time casa do 1º jogo",
  "away_team": "Time visitante do 1º jogo",
  "league": null,
  "market": "other",
  "selection": "Múltipla: [Seleção1] + [Seleção2] + ...",
  "odd": 9.99,
  "stake": 50.00,
  "potential_return": 499.50,
  "match_date": "YYYY-MM-DD",
  "bookmaker": "nome da casa ou null",
  "legs": [
    { "home_team": "Time A", "away_team": "Time B", "selection": "Ambas marcam - Sim", "odd": 2.15, "market": "both_teams_score" },
    { "home_team": "Time C", "away_team": "Time D", "selection": "Ambas marcam - Sim", "odd": 3.40, "market": "both_teams_score" }
  ]
}

Regras de mercado:
- match_winner: resultado final (1X2)
- over_under: mais/menos gols
- both_teams_score: ambas as equipes marcam
- handicap: handicap asiático ou europeu
- correct_score: placar exato
- other: qualquer outro mercado

Regras gerais:
- stake: valor apostado (procure "Valor", "Aposta", "Investimento" no bilhete — pode estar no final)
- potential_return: retorno potencial (procure "Retorno", "Ganho potencial", "Possível retorno")
- Se não encontrar stake ou potential_return, use 0
- odd: para múltipla, use a odd total do bilhete
- Se não conseguir identificar algum campo string, use null`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Sem JSON na resposta')

    const parsed = JSON.parse(jsonMatch[0])

    const result = BetExtractionSchema.safeParse(parsed)
    if (!result.success) {
      // Tenta usar os dados mesmo assim, com fallbacks
      extracted = {
        home_team: parsed.home_team ?? '',
        away_team: parsed.away_team ?? '',
        league: parsed.league ?? null,
        market: parsed.market ?? 'other',
        selection: parsed.selection ?? '',
        odd: Number(parsed.odd) || 0,
        stake: Number(parsed.stake) || 0,
        potential_return: Number(parsed.potential_return) || 0,
        match_date: parsed.match_date ?? new Date().toISOString().split('T')[0],
        bookmaker: parsed.bookmaker ?? null,
        is_multiple: parsed.is_multiple ?? false,
        legs: parsed.legs ?? null,
      } as z.infer<typeof BetExtractionSchema>
    } else {
      extracted = result.data
    }
  } catch {
    return NextResponse.json({
      success: false,
      screenshot_url: path,
      error: 'Não consegui ler o bilhete automaticamente. Preencha os dados manualmente.',
    })
  }

  return NextResponse.json({
    success: true,
    screenshot_url: path,
    data: extracted,
  })
}
