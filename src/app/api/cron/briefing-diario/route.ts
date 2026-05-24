import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

function timingSafeEqual(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  const auth = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || !auth || !timingSafeEqual(auth, expected)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Gerar briefing do dia
  const briefingRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/briefing/gerar`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const briefingJson = await briefingRes.json()
  if (!briefingJson.success) {
    return NextResponse.json({ error: 'Falha ao gerar briefing' }, { status: 500 })
  }

  const content: string = briefingJson.briefing?.content ?? ''
  const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').trim()

  // Buscar todas as subscriptions ativas
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subscriptions } = await (admin as any)
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth') as { data: Array<{ endpoint: string; p256dh: string; auth: string }> | null }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ success: true, sent: 0 })
  }

  const payload = JSON.stringify({
    title: 'BetCopiloto — Briefing do dia',
    body: firstLine.length > 100 ? firstLine.slice(0, 97) + '...' : firstLine,
    url: '/dashboard',
  })

  let sent = 0
  const dead: string[] = []

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      sent++
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.endpoint)
    }
  }))

  // Limpar subscriptions expiradas
  if (dead.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('push_subscriptions').delete().in('endpoint', dead)
  }

  return NextResponse.json({ success: true, sent, removed: dead.length })
}
