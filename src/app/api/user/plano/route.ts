import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ plan: 'free' })

  const { data } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single<{ plan: string; plan_expires_at: string | null }>()

  const isPro = data?.plan === 'pro' &&
    (!data.plan_expires_at || new Date(data.plan_expires_at) > new Date())

  return NextResponse.json({ plan: isPro ? 'pro' : 'free' })
}
