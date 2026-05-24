import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPasswordResetEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  // Gera o link de reset via Supabase Admin (sem enviar e-mail pelo Supabase)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/update-password`,
    },
  })

  if (error || !data?.properties?.action_link) {
    // Retorna ok mesmo se e-mail não existe (segurança — não revelar cadastros)
    return NextResponse.json({ ok: true })
  }

  await sendPasswordResetEmail(email, data.properties.action_link).catch(() => {})

  return NextResponse.json({ ok: true })
}
