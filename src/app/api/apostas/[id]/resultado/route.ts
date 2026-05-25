import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Schema = z.object({
  status: z.enum(['won', 'lost', 'void']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const body = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })

  const { status } = parsed.data

  // Buscar aposta — garante que pertence ao usuário
  const { data: bet } = await supabase
    .from('bets')
    .select('id, status, stake, potential_return')
    .eq('id', id)
    .eq('user_id', user.id)
    .single<{ id: string; status: string; stake: number; potential_return: number }>()

  if (!bet) return NextResponse.json({ error: 'Aposta não encontrada' }, { status: 404 })
  if (bet.status !== 'pending') return NextResponse.json({ error: 'Aposta já foi resolvida' }, { status: 400 })

  // Atualizar status da aposta
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase as any)
    .from('bets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateErr) return NextResponse.json({ error: 'Erro ao atualizar aposta' }, { status: 500 })

  // Atualizar banca
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_bankroll')
    .eq('id', user.id)
    .single<{ current_bankroll: number }>()

  if (profile) {
    let delta = 0
    if (status === 'won') delta = bet.potential_return - bet.stake  // lucro líquido
    if (status === 'lost') delta = -bet.stake                        // perde o que apostou
    // void: não muda nada

    if (delta !== 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('profiles')
        .update({ current_bankroll: Math.max(0, profile.current_bankroll + delta) })
        .eq('id', user.id)
    }
  }

  return NextResponse.json({ success: true, status })
}
