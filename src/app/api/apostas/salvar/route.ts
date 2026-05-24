import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchFixture } from '@/lib/api-football'
import { z } from 'zod'

const SaveBetSchema = z.object({
  home_team: z.string().min(1),
  away_team: z.string().min(1),
  league: z.string().nullable().optional(),
  market: z.enum(['match_winner', 'over_under', 'both_teams_score', 'handicap', 'correct_score', 'other']),
  selection: z.string().min(1),
  odd: z.number().positive(),
  stake: z.number().nonnegative(),
  potential_return: z.number().nonnegative(),
  match_date: z.string(),
  bookmaker: z.string().nullable().optional(),
  screenshot_url: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_multiple: z.boolean().optional(),
  legs: z.array(z.object({
    home_team: z.string(),
    away_team: z.string(),
    selection: z.string(),
    odd: z.number(),
    market: z.string(),
  })).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = SaveBetSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const bet = parsed.data

  // Tenta vincular fixture_id em background — não bloqueia o save se falhar
  let fixtureId: number | null = null
  try {
    const fixture = await searchFixture(bet.home_team, bet.away_team, bet.match_date)
    fixtureId = fixture?.fixture.id ?? null
  } catch { /* ignora — fixture_id é preenchido pelo cron depois */ }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from('bets').insert({
    user_id: user.id,
    home_team: bet.home_team,
    away_team: bet.away_team,
    league: bet.league ?? null,
    market: bet.market,
    selection: bet.selection,
    odd: bet.odd,
    stake: bet.stake,
    potential_return: bet.potential_return,
    match_date: bet.match_date,
    bookmaker: bet.bookmaker ?? null,
    screenshot_url: bet.screenshot_url ?? null,
    notes: bet.notes ?? null,
    fixture_id: fixtureId,
    status: 'pending',
    is_multiple: bet.is_multiple ?? false,
    legs: bet.legs ?? null,
  }).select('id').single() as { data: { id: string } | null; error: unknown }

  if (error) {
    return NextResponse.json({ error: 'Erro ao salvar aposta.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data?.id })
}
