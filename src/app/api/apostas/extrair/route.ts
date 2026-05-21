import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const BetExtractionSchema = z.object({
  home_team: z.string(),
  away_team: z.string(),
  league: z.string().nullable(),
  market: z.enum(['match_winner', 'over_under', 'both_teams_score', 'handicap', 'correct_score', 'other']),
  selection: z.string(),
  odd: z.number().positive(),
  stake: z.number().positive(),
  potential_return: z.number().positive(),
  match_date: z.string(),
  bookmaker: z.string().nullable(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

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

Retorne APENAS o JSON, sem texto adicional, no seguinte formato:
{
  "home_team": "nome do time da casa",
  "away_team": "nome do time visitante",
  "league": "nome da liga ou null",
  "market": "match_winner | over_under | both_teams_score | handicap | correct_score | other",
  "selection": "descrição da seleção feita (ex: 'Flamengo', 'Over 2.5', 'Ambas marcam')",
  "odd": 1.85,
  "stake": 50.00,
  "potential_return": 92.50,
  "match_date": "YYYY-MM-DD",
  "bookmaker": "nome da casa de apostas ou null"
}

Regras:
- match_winner: resultado final (1X2)
- over_under: mais/menos gols
- both_teams_score: ambas as equipes marcam
- handicap: handicap asiático ou europeu
- correct_score: placar exato
- other: qualquer outro mercado
- Se houver múltiplas apostas no bilhete, extraia apenas a primeira
- Se não conseguir identificar algum campo, use null para strings e 0 para números`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Resposta inválida da IA')

    const parsed = JSON.parse(jsonMatch[0])
    extracted = BetExtractionSchema.parse(parsed)
  } catch {
    // Retorna dados parciais com screenshot_url para o usuário preencher manualmente
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
