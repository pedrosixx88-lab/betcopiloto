import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AvaliarClient from '@/components/avaliar/avaliar-client'

export default async function AvaliarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, avaliacoes_gratuitas, current_bankroll')
    .eq('id', user.id)
    .single<{ plan: string; plan_expires_at: string | null; avaliacoes_gratuitas: number; current_bankroll: number }>()

  const isPro = profile?.plan === 'pro' &&
    (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date())

  const avaliacoesUsadas = profile?.avaliacoes_gratuitas ?? 0
  const podeUsarGratis = !isPro && avaliacoesUsadas === 0

  return (
    <AvaliarClient
      isPro={isPro}
      podeUsarGratis={podeUsarGratis}
      avaliacoesUsadas={avaliacoesUsadas}
    />
  )
}
