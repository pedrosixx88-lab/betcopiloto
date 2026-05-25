'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, Loader2, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })
      setSent(true)
    } catch {
      toast.error('Erro ao enviar e-mail. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-6">
            <TrendingUp className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">BetCopiloto</span>
          </div>
          <h1 className="text-2xl font-bold">Recuperar senha</h1>
          <p className="text-muted-foreground text-sm">
            Digite seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-primary mx-auto" />
            <p className="text-sm font-medium">E-mail enviado!</p>
            <p className="text-sm text-muted-foreground">
              Verifique sua caixa de entrada e clique no link para redefinir sua senha.
            </p>
            <Link href="/login" className="text-primary hover:underline text-sm font-medium">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar link de recuperação'}
            </Button>
          </form>
        )}

        {!sent && (
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="flex items-center justify-center gap-1 hover:text-primary transition-colors">
              <ArrowLeft className="h-3 w-3" /> Voltar para o login
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
