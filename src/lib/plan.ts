import { createClient } from '@/lib/supabase/server'

export type Plan = 'free' | 'pro'

export interface PlanGates {
  plan: Plan
  canBuildTicket: boolean
  canAnalyseGame: boolean
  analysesUsedToday: number
  analysesLimit: number
  canReceivePush: boolean
}

export const FREE_ANALYSIS_LIMIT = 3

export async function getUserPlan(): Promise<PlanGates> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return defaultGates('free')

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single<{ plan: string; plan_expires_at: string | null }>()

  let plan: Plan = 'free'
  if (profile?.plan === 'pro') {
    const expires = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null
    if (!expires || expires > new Date()) plan = 'pro'
  }

  if (plan === 'pro') return defaultGates('pro')

  // Contar análises geradas hoje (free limit)
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('game_analyses')
    .select('fixture_id', { count: 'exact', head: true })
    .eq('requested_by', user.id)
    .gte('created_at', `${today}T00:00:00`)

  const analysesUsedToday = count ?? 0

  return {
    plan: 'free',
    canBuildTicket: false,
    canAnalyseGame: analysesUsedToday < FREE_ANALYSIS_LIMIT,
    analysesUsedToday,
    analysesLimit: FREE_ANALYSIS_LIMIT,
    canReceivePush: false,
  }
}

function defaultGates(plan: Plan): PlanGates {
  if (plan === 'pro') return {
    plan: 'pro',
    canBuildTicket: true,
    canAnalyseGame: true,
    analysesUsedToday: 0,
    analysesLimit: Infinity,
    canReceivePush: true,
  }
  return {
    plan: 'free',
    canBuildTicket: false,
    canAnalyseGame: true,
    analysesUsedToday: 0,
    analysesLimit: FREE_ANALYSIS_LIMIT,
    canReceivePush: false,
  }
}
