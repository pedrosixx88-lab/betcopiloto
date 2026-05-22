'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, Loader2, CheckCircle } from 'lucide-react'

function RegisterForm() {
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [refCode] = useState<string | null>(() => searchParams.get('ref'))

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres')
      return
    }
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, referred_by: refCode ?? null },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center space-y-4">
        <CheckCircle className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-2xl font-bold">Verifique seu e-mail</h1>
        <p className="text-muted-foreground text-sm">
          Enviamos um link de confirmação para <strong>{email}</strong>. Clique no link para ativar sua conta.
        </p>
        <p className="text-xs text-muted-foreground">Não recebeu? Verifique a pasta de spam.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-6">
          <TrendingUp className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">BetCopiloto</span>
        </div>
        <h1 className="text-2xl font-bold">Crie sua conta grátis</h1>
        <p className="text-muted-foreground text-sm">Comece a controlar suas apostas hoje</p>
        {refCode && (
          <p className="text-xs text-primary">Você foi indicado por um amigo!</p>
        )}
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Como quer ser chamado?</Label>
          <Input
            id="name"
            type="text"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar conta grátis'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Entrar
        </Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-primary" />}>
        <RegisterForm />
      </Suspense>
    </div>
  )
}
