import Link from 'next/link'
import { CheckCircle, Crown, ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function CheckoutSucessoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">

        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
          <p className="text-zinc-400 text-sm">
            Seu plano Pro está sendo ativado. Em instantes você terá acesso completo ao BetCopiloto.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left space-y-3">
          <p className="text-xs font-semibold text-green-500 uppercase tracking-wider">Você desbloqueou</p>
          {[
            'Análise completa de cada jogo com IA',
            'Chat IA sobre qualquer jogo',
            'Montador de bilhete inteligente',
            'Push notification do briefing diário',
            'Suporte prioritário',
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-zinc-300">
              <Crown className="h-3.5 w-3.5 text-green-500 shrink-0" />
              {f}
            </div>
          ))}
        </div>

        <Link
          href="/dashboard"
          className={cn(buttonVariants(), 'w-full justify-center gap-2')}
        >
          Ir para o Dashboard <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="text-xs text-zinc-500">
          Você também receberá um e-mail de confirmação em breve.
        </p>
      </div>
    </div>
  )
}
