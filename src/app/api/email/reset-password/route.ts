import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPasswordResetEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Rate limit: max 3 tentativas por IP a cada 15 minutos
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: true }) // Retorna ok para não revelar rate limit
  }

  const { email } = await request.json()
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ ok: true })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.auth.admin as any).generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/update-password`,
    },
  })

  if (error || !data?.properties?.action_link) {
    // Retorna ok mesmo se e-mail não existe — não revelar cadastros
    return NextResponse.json({ ok: true })
  }

  await sendPasswordResetEmail(email, data.properties.action_link).catch(() => {})

  return NextResponse.json({ ok: true })
}
