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
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Listener para evento PASSWORD_RECOVERY — disparado quando o Supabase
    // processa automaticamente o hash #access_token=...&type=recovery da URL
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setReady(true)
      }
    })

    // Se já tem sessão ativa (veio via redirect server-side)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Timeout de 8 segundos para mostrar "link expirado"
  useEffect(() => {
    if (ready) return
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) setInvalid(true)
    }, 8000)
    return () => clearTimeout(timer)
  }, [ready])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('As senhas não coincidem'); return }
    if (password.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return }
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

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">BetCopiloto</span>
          </div>
          <h1 className="text-2xl font-bold">Link expirado</h1>
          <p className="text-muted-foreground text-sm">Este link é inválido ou já expirou.</p>
          <a href="/reset-password" className="inline-block w-full bg-primary text-primary-foreground text-center py-3 rounded-lg font-medium text-sm">
            Solicitar novo link
          </a>
        </div>
      </div>
    )
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
              <Input id="password" type="password" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input id="confirm" type="password" placeholder="••••••••" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
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
