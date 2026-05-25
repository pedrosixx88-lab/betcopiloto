'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, Loader2 } from 'lucide-react'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })

    // Verifica sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    // Fallback: se em 3s ainda não tiver sessão, mostra o form mesmo assim
    const timer = setTimeout(() => setReady(true), 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('As senhas não coincidem')
      return
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres')
      return
    }
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast.error('Erro ao atualizar senha. Tente novamente.')
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    toast.success('Senha atualizada! Faça login com a nova senha.')
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-6">
            <TrendingUp className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">BetCopiloto</span>
          </div>
          <h1 className="text-2xl font-bold">Nova senha</h1>
          <p className="text-muted-foreground text-sm">Digite sua nova senha abaixo.</p>
        </div>

        {!ready ? (
          <div className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando link...
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar nova senha'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
