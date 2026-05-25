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
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?type=recovery`,
    },
  })

  if (error) {
    console.error('[reset-password] generateLink error:', error.message)
    return NextResponse.json({ ok: true })
  }

  if (!data?.properties?.action_link) {
    console.error('[reset-password] sem action_link, data:', JSON.stringify(data))
    return NextResponse.json({ ok: true })
  }

  console.log('[reset-password] action_link:', data.properties.action_link)

  const resendResult = await sendPasswordResetEmail(email, data.properties.action_link).catch(e => {
    console.error('[reset-password] resend error:', e?.message)
    return null
  })
  console.log('[reset-password] resend result:', JSON.stringify(resendResult))

  return NextResponse.json({ ok: true })
}
