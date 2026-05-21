import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { TrendingUp } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="space-y-6 max-w-md">
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold tracking-tight">BetCopiloto</span>
        </div>
        <h1 className="text-4xl font-bold leading-tight">
          Seu segundo cérebro nas apostas
        </h1>
        <p className="text-muted-foreground">
          Registre apostas com um print, acompanhe sua performance e receba bilhetes personalizados com IA.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/register" className={buttonVariants({ size: 'lg', className: 'font-semibold' })}>
            Começar grátis
          </Link>
          <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Entrar
          </Link>
        </div>
      </div>
    </div>
  )
}
