import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// Rota APENAS para desenvolvimento local
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const email = process.env.DEV_LOGIN_EMAIL
  if (!email) return NextResponse.json({ error: 'DEV_LOGIN_EMAIL não configurado' }, { status: 500 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  })

  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message ?? 'generateLink falhou' }, { status: 500 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  })

  if (verifyError || !session?.session) {
    return NextResponse.json({ error: verifyError?.message ?? 'verifyOtp falhou', hashed_token: data.properties.hashed_token }, { status: 500 })
  }

  // Devolver HTML com cookies já definidos + redirect JS
  // (NextResponse.redirect perderia os cookies — HTML resolve isso)
  const res = new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8">
    <script>window.location.replace('/dashboard')</script>
    </head><body>Redirecionando...</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )

  // Copiar cookies definidos pelo supabase para a resposta
  cookieStore.getAll().forEach(cookie => {
    res.cookies.set(cookie.name, cookie.value, { path: '/', httpOnly: true, sameSite: 'lax' })
  })

  return res
}
