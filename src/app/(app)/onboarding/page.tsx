'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, Loader2, DollarSign, Trophy, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const LEAGUES = [
  { id: 'brasileirao-a', label: 'Brasileirão Série A' },
  { id: 'brasileirao-b', label: 'Brasileirão Série B' },
  { id: 'champions', label: 'Champions League' },
  { id: 'premier-league', label: 'Premier League' },
  { id: 'la-liga', label: 'La Liga' },
  { id: 'serie-a', label: 'Serie A (Itália)' },
  { id: 'bundesliga', label: 'Bundesliga' },
  { id: 'libertadores', label: 'Copa Libertadores' },
]

const BOOKMAKERS = ['Betano', 'Bet365', 'Sportingbet', 'Pixbet', 'Novibet', 'Betfair', 'KTO', 'Outra']

const STEPS = ['Banca inicial', 'Ligas favoritas', 'Casa de aposta']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [bankroll, setBankroll] = useState('')
  const [leagues, setLeagues] = useState<string[]>([])
  const [bookmaker, setBookmaker] = useState('')
  const [loading, setLoading] = useState(false)

  function toggleLeague(id: string) {
    setLeagues(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id])
  }

  async function handleFinish() {
    if (!bookmaker) { toast.error('Selecione sua casa de aposta principal'); return }
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const value = parseFloat(bankroll.replace(',', '.')) || 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('profiles').update({
      initial_bankroll: value,
      current_bankroll: value,
      favorite_leagues: leagues,
      main_bookmaker: bookmaker,
      onboarding_completed: true,
    }).eq('id', user.id)

    if (error) { toast.error('Erro ao salvar. Tente novamente.'); setLoading(false); return }

    router.push('/dashboard')
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">

        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-6">
            <TrendingUp className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">BetCopiloto</span>
          </div>
          <p className="text-muted-foreground text-sm">Passo {step + 1} de {STEPS.length} — {STEPS[step]}</p>
          <Progress value={progress} className="mt-3 h-1" />
        </div>

        {/* Step 0 — Banca */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-brand-muted flex items-center justify-center mx-auto">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Qual é sua banca inicial?</h2>
              <p className="text-muted-foreground text-sm">O valor que você destina mensalmente para apostas. Pode alterar depois.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankroll">Valor em R$</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="bankroll"
                  type="number"
                  placeholder="0,00"
                  className="pl-10"
                  value={bankroll}
                  onChange={(e) => setBankroll(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <Button className="w-full" onClick={() => setStep(1)}>
              Continuar
            </Button>
          </div>
        )}

        {/* Step 1 — Ligas */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-brand-muted flex items-center justify-center mx-auto">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Quais ligas você acompanha?</h2>
              <p className="text-muted-foreground text-sm">Seus bilhetes serão montados com foco nessas ligas.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LEAGUES.map(league => (
                <button
                  key={league.id}
                  onClick={() => toggleLeague(league.id)}
                  className={cn(
                    'p-3 rounded-lg border text-sm text-left transition-all',
                    leagues.includes(league.id)
                      ? 'border-primary bg-brand-muted text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-border/80'
                  )}
                >
                  {league.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Voltar</Button>
              <Button className="flex-1" onClick={() => setStep(2)}>Continuar</Button>
            </div>
          </div>
        )}

        {/* Step 2 — Casa de aposta */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-brand-muted flex items-center justify-center mx-auto">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Onde você aposta mais?</h2>
              <p className="text-muted-foreground text-sm">Usamos isso para reconhecer seus prints automaticamente.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {BOOKMAKERS.map(bm => (
                <button
                  key={bm}
                  onClick={() => setBookmaker(bm)}
                  className={cn(
                    'p-3 rounded-lg border text-sm transition-all',
                    bookmaker === bm
                      ? 'border-primary bg-brand-muted text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-border/80'
                  )}
                >
                  {bm}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="flex-1" onClick={handleFinish} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Começar a usar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
