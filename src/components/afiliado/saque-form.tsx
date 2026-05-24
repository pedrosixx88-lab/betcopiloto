'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type PixKeyType = 'cpf' | 'email' | 'telefone' | 'aleatoria'

interface Props {
  pendingPayout: number
  pixKey: string | null
  pixKeyType: PixKeyType | null
  activeReferrals: number
}

const PIX_TYPES: { value: PixKeyType; label: string; placeholder: string }[] = [
  { value: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
  { value: 'email', label: 'E-mail', placeholder: 'seu@email.com' },
  { value: 'telefone', label: 'Telefone', placeholder: '+55 11 99999-9999' },
  { value: 'aleatoria', label: 'Chave aleatória', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
]

export default function SaqueForm({ pendingPayout, pixKey: initialPixKey, pixKeyType: initialPixKeyType, activeReferrals }: Props) {
  const [pixKey, setPixKey] = useState(initialPixKey ?? '')
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>(initialPixKeyType ?? 'cpf')
  const [savingPix, setSavingPix] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [pixSaved, setPixSaved] = useState(!!initialPixKey)

  async function handleSavePix() {
    if (!pixKey.trim()) { toast.error('Digite sua chave Pix'); return }
    setSavingPix(true)
    try {
      const res = await fetch('/api/afiliado/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pix_key: pixKey.trim(), pix_key_type: pixKeyType }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success('Chave Pix salva!')
      setPixSaved(true)
    } catch {
      toast.error('Erro ao salvar chave Pix.')
    } finally {
      setSavingPix(false)
    }
  }

  async function handleSaque() {
    if (!pixSaved) { toast.error('Salve sua chave Pix primeiro'); return }
    if (activeReferrals < 1) { toast.error('Indique pelo menos 1 cliente para sacar'); return }
    if (pendingPayout <= 0) { toast.error('Você não tem saldo disponível'); return }
    setRequesting(true)
    try {
      const res = await fetch('/api/afiliado/saque', { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(`Saque de R$ ${pendingPayout.toFixed(2)} solicitado! Será processado em até 1 dia útil.`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao solicitar saque.')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Chave Pix */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Chave Pix para receber</Label>

        {/* Tipo */}
        <div className="grid grid-cols-4 gap-1.5">
          {PIX_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => { setPixKeyType(t.value); setPixSaved(false) }}
              className={cn(
                'py-1.5 rounded-lg text-xs font-medium border transition-all',
                pixKeyType === t.value
                  ? 'border-primary bg-brand-muted text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={pixKey}
            onChange={e => { setPixKey(e.target.value); setPixSaved(false) }}
            placeholder={PIX_TYPES.find(t => t.value === pixKeyType)?.placeholder}
            className="flex-1 text-sm"
          />
          <Button
            onClick={handleSavePix}
            disabled={savingPix || pixSaved}
            variant={pixSaved ? 'outline' : 'default'}
            className="shrink-0"
          >
            {savingPix ? <Loader2 className="h-4 w-4 animate-spin" /> : pixSaved ? '✓ Salvo' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Botão saque */}
      <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Saldo disponível</p>
          <p className={cn('text-2xl font-bold', pendingPayout > 0 && activeReferrals >= 1 ? 'text-primary' : 'text-muted-foreground')}>
            R$ {pendingPayout.toFixed(2)}
          </p>
          {activeReferrals < 1 && (
            <p className="text-xs text-muted-foreground mt-0.5">Indique 1 cliente para liberar o saque</p>
          )}
        </div>
        <Button
          onClick={handleSaque}
          disabled={requesting || pendingPayout <= 0 || activeReferrals < 1 || !pixSaved}
          className="gap-2 shrink-0"
        >
          {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          Sacar via Pix
        </Button>
      </div>
    </div>
  )
}
