import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BilheteClient from '@/components/bilhete/bilhete-client'
import { Crown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default async function BilhetePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single<{ plan: string; plan_expires_at: string | null }>()

  const isPro = profile?.plan === 'pro' &&
    (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date())

  if (!isPro) {
    return (
      <div className="p-4 md:p-8 max-w-lg mx-auto space-y-5 pb-24">
        <div className="pt-2">
          <h1 className="text-xl font-bold">Montador de bilhete</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bilhete personalizado com IA</p>
        </div>

        <Card className="border-primary/30 bg-brand-muted">
          <CardContent className="py-8 px-6 text-center space-y-4">
            <Crown className="h-10 w-10 text-primary mx-auto" />
            <div>
              <p className="font-semibold text-base">Funcionalidade Pro</p>
              <p className="text-sm text-muted-foreground mt-1">
                O montador de bilhete inteligente é exclusivo do plano Pro. A IA cruza suas análises, histórico e gestão de banca para montar o bilhete ideal.
              </p>
            </div>
            <Link href="/planos" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
              <Crown className="h-4 w-4" /> Assinar Pro — R$ 49/mês
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <BilheteClient />
}
