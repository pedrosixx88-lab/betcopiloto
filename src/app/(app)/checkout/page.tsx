'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function CheckoutPage() {
  const router = useRouter()
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const digits = cpf.replace(/\D/g, '')
    if (digits.length !== 11) {
      setError('CPF inválido. Digite os 11 dígitos.')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/checkout/criar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: digits }),
    })
    if (res.redirected) {
      window.location.href = res.url
      return
    }
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      setError(data.detail ?? data.error ?? 'Erro ao processar. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Assinar Pro</h1>
          <p className="text-zinc-400 text-sm">R$ 49,90/mês — cancele quando quiser</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">CPF</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={e => setCpf(formatCPF(e.target.value))}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white text-lg tracking-widest focus:outline-none focus:border-green-500"
              required
            />
            <p className="text-xs text-zinc-500 mt-1">Necessário para emissão do recibo de pagamento.</p>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Aguarde...' : 'Continuar para pagamento →'}
          </button>

          <p className="text-center text-xs text-zinc-500">
            Pagamento seguro via Asaas • Pix, cartão ou boleto
          </p>
        </form>
      </div>
    </div>
  )
}
