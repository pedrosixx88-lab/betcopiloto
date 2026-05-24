import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFixtureById, searchFixture, resolveMatchWinner } from '@/lib/api-football'
import crypto from 'crypto'

function timingSafeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') ?? request.nextUrl.searchParams.get('secret')
  const expected = process.env.CRON_SECRET
  if (!expected || !secret || !timingSafeEqual(secret, expected)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Busca apostas pendentes com data de jogo <= hoje
  const today = new Date().toISOString().split('T')[0]
  const { data: bets, error } = await supabase
    .from('bets')
    .select('id, home_team, away_team, market, selection, match_date, fixture_id')
    .eq('status', 'pending')
    .lte('match_date', today)
    .returns<Array<{
      id: string
      home_team: string
      away_team: string
      market: string
      selection: string
      match_date: string
      fixture_id: number | null
    }>>()

  if (error || !bets) {
    return NextResponse.json({ error: 'Erro ao buscar apostas' }, { status: 500 })
  }

  const results = { updated: 0, skipped: 0, errors: 0 }

  for (const bet of bets) {
    try {
      let fixture = null

      if (bet.fixture_id) {
        fixture = await getFixtureById(bet.fixture_id)
      } else {
        fixture = await searchFixture(bet.home_team, bet.away_team, bet.match_date)
        // Salva o fixture_id para próximas buscas
        if (fixture) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('bets').update({ fixture_id: fixture.fixture.id }).eq('id', bet.id)
        }
      }

      if (!fixture) { results.skipped++; continue }

      const newStatus = resolveMatchWinner(fixture, bet.selection, bet.market)
      if (!newStatus) { results.skipped++; continue }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('bets').update({ status: newStatus }).eq('id', bet.id)
      results.updated++
    } catch {
      results.errors++
    }
  }

  return NextResponse.json({ success: true, ...results, total: bets.length })
}
