import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // 1 e-mail de boas-vindas por usuário a cada 24 horas
  if (!rateLimit(`boas-vindas:${user.id}`, 1, 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ ok: true })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('name, email')
    .eq('id', user.id)
    .single()

  const email = profile?.email ?? user.email
  const name = profile?.name?.split(' ')[0] ?? 'apostador'

  if (!email) return NextResponse.json({ error: 'E-mail não encontrado' }, { status: 400 })

  await sendWelcomeEmail(email, name).catch(() => {})

  return NextResponse.json({ ok: true })
}
