import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, current_bankroll, onboarding_completed')
    .eq('id', user.id)
    .single<{ name: string | null; current_bankroll: number; onboarding_completed: boolean }>()

  if (!profile?.onboarding_completed) redirect('/onboarding')

  const { data: bets } = await supabase
    .from('bets')
    .select('status, stake, potential_return')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<Array<{ status: string; stake: number; potential_return: number }>>()

  const totalBets = bets?.length ?? 0
  const wonBets = bets?.filter(b => b.status === 'won').length ?? 0
  const lostBets = bets?.filter(b => b.status === 'lost').length ?? 0
  const settledBets = wonBets + lostBets
  const winRate = settledBets > 0 ? ((wonBets / settledBets) * 100).toFixed(1) : '—'

  const profit = bets?.reduce((acc, bet) => {
    if (bet.status === 'won') return acc + (bet.potential_return - bet.stake)
    if (bet.status === 'lost') return acc - bet.stake
    return acc
  }, 0) ?? 0

  const totalStaked = bets?.filter(b => b.status !== 'pending').reduce((acc, b) => acc + b.stake, 0) ?? 0
  const roi = totalStaked > 0 ? ((profit / totalStaked) * 100).toFixed(1) : '—'

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Olá, {profile?.name?.split(' ')[0] ?? 'apostador'} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Aqui está sua performance</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Banca atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              R$ {profile?.current_bankroll?.toFixed(2) ?? '0,00'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              {profit >= 0 ? <TrendingUp className="h-3 w-3 text-primary" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
              Lucro/Prejuízo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {profit >= 0 ? '+' : ''}R$ {profit.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Target className="h-3 w-3" /> Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{winRate}{winRate !== '—' ? '%' : ''}</p>
            <p className="text-xs text-muted-foreground">{settledBets} apostas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${roi !== '—' && parseFloat(roi) >= 0 ? 'text-primary' : roi !== '—' ? 'text-destructive' : ''}`}>
              {roi}{roi !== '—' ? '%' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {totalBets === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="font-semibold">Nenhuma aposta ainda</h3>
            <p className="text-sm text-muted-foreground">
              Registre sua primeira aposta para ver sua performance aqui.
            </p>
            <Badge variant="outline" className="text-primary border-primary">
              Em breve: upload de print
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
