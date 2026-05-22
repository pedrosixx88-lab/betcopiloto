import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Check, Zap, Crown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const FREE_FEATURES = [
  'Registro ilimitado de apostas',
  'Dashboard com métricas e ROI',
  'Lista de jogos do dia',
  'Briefing diário (sem push)',
]

const PRO_FEATURES = [
  'Tudo do plano Free',
  'Análise completa de cada jogo com IA',
  'Chat IA sobre qualquer jogo',
  'Montador de bilhete inteligente',
  'Push notification do briefing',
  'Suporte prioritário',
]

export default async function PlanosPage() {
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

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 pb-24">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Planos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isPro ? 'Você está no plano Pro.' : 'Faça upgrade para desbloquear todas as funcionalidades.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Free */}
        <Card className={cn('border', !isPro && 'border-border')}>
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" /> Free
              </CardTitle>
              {!isPro && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Plano atual</span>
              )}
            </div>
            <p className="text-2xl font-bold mt-1">R$ 0<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-2">
            {FREE_FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {f}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pro */}
        <Card className="border-primary/40 bg-brand-muted">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" /> Pro
              </CardTitle>
              {isPro && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Plano atual</span>
              )}
            </div>
            <p className="text-2xl font-bold mt-1 text-primary">R$ 29<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-2">
            {PRO_FEATURES.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                {f}
              </div>
            ))}
            {!isPro && (
              <div className="pt-3">
                <Link
                  href="/api/checkout/criar"
                  className={cn(buttonVariants({ size: 'sm' }), 'w-full justify-center')}
                >
                  <Crown className="h-4 w-4 mr-1.5" /> Assinar Pro — R$ 29/mês
                </Link>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Cancele quando quiser. Pagamento via Mercado Pago.
                </p>
              </div>
            )}
            {isPro && (
              <div className="pt-3">
                <Link
                  href="/api/checkout/cancelar"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-center')}
                >
                  Cancelar assinatura
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Afiliados */}
      <Card>
        <CardContent className="py-4 px-5">
          <p className="text-sm font-semibold">Programa de afiliados</p>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Indique amigos e ganhe 30% de comissão recorrente por cada assinante ativo.
          </p>
          <Link href="/afiliado" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Ver meu painel de afiliado
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
