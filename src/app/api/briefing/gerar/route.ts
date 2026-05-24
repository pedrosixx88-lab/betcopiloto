import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getFixturesByDate, FEATURED_LEAGUES } from '@/lib/api-football'
import crypto from 'crypto'

function timingSafeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

function getDateBRT(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`
}

export async function POST(request: NextRequest) {
  // Autenticação: aceita cron secret ou usuário logado
  const authHeader = request.headers.get('authorization')
  const isCron = !!process.env.CRON_SECRET && !!authHeader && timingSafeEqual(authHeader, `Bearer ${process.env.CRON_SECRET}`)

  if (!isCron) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const today = getDateBRT()
  const admin = createAdminClient()

  // Retorna briefing já existente do dia se não for forced
  const forceNew = request.headers.get('x-force-new') === '1'
  if (!forceNew) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('daily_briefings')
      .select('content, games_count, created_at')
      .eq('date', today)
      .single()

    if (existing) return NextResponse.json({ success: true, briefing: existing, cached: true })
  }

  // Buscar jogos do dia
  const featuredIds = new Set(FEATURED_LEAGUES.map(l => l.id))
  const leagueMap = Object.fromEntries(FEATURED_LEAGUES.map(l => [l.id, l]))
  const FINISHED = ['FT', 'AET', 'PEN', 'ABD', 'WO', 'AWD', 'CANC']

  const fixtures = await getFixturesByDate(today).catch(() => [])
  const games = fixtures
    .filter(f => featuredIds.has(f.league.id) && !FINISHED.includes(f.fixture.status.short))
    .map(f => ({
      home: f.teams.home.name,
      away: f.teams.away.name,
      league: leagueMap[f.league.id]?.name ?? f.league.name,
      time: new Date(f.fixture.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
    }))
    .sort((a, b) => a.time.localeCompare(b.time))

  if (games.length === 0) {
    return NextResponse.json({ success: true, briefing: { content: 'Sem jogos disponíveis hoje nas ligas monitoradas.', games_count: 0 }, cached: false })
  }

  const gamesText = games.map(g => `• ${g.time} — ${g.home} vs ${g.away} (${g.league})`).join('\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Você é o BetCopiloto, assistente de apostas esportivas. Crie um briefing diário conciso e direto para apostadores brasileiros.

JOGOS DE HOJE (${today}):
${gamesText}

Escreva um briefing em PT-BR com:
1. Saudação curta com a data de hoje
2. Destaques do dia: 2-3 jogos mais interessantes, cada um em uma linha com o nome das equipes em negrito e 1 frase de análise
3. Uma dica de gestão de banca em 1 frase

Regras de formato:
- Use apenas **negrito** para nomes de times/competições
- Separe as seções com uma linha em branco
- SEM títulos com ##, SEM --- separadores, SEM emojis excessivos
- Máximo 180 palavras. Tom direto e objetivo.
- Não invente estatísticas`,
    }],
  })

  const content = response.content[0].type === 'text' ? response.content[0].text : ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('daily_briefings').upsert({
    date: today,
    content,
    games_count: games.length,
  }, { onConflict: 'date' })

  return NextResponse.json({ success: true, briefing: { content, games_count: games.length }, cached: false })
}
