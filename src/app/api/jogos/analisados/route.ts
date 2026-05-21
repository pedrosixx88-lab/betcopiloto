import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('game_analyses')
    .select('fixture_id, home_team, away_team, league, summary')
    .gte('match_date', today)
    .order('created_at', { ascending: false })
    .returns<Array<{
      fixture_id: number
      home_team: string
      away_team: string
      league: string
      summary: Record<string, unknown>
    }>>()

  return NextResponse.json({ success: true, games: data ?? [] })
}
