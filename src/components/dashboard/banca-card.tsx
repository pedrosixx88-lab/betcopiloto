'use client'

import { useState, useRef, useEffect } from 'react'
import { DollarSign, Pencil, Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function BancaCard({ initialValue }: { initialValue: number }) {
  const [value, setValue] = useState(initialValue)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setInput(value.toFixed(2).replace('.', ','))
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [editing, value])

  async function handleSave() {
    const parsed = parseFloat(input.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Valor inválido')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({ current_bankroll: parsed })
      .eq('id', user.id)

    if (error) {
      toast.error('Erro ao salvar')
    } else {
      setValue(parsed)
      setEditing(false)
      toast.success('Banca atualizada')
    }
    setSaving(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
          <DollarSign className="h-3 w-3" /> Banca atual
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {editing ? (
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-muted-foreground">R$</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-2xl font-bold bg-transparent border-b border-primary outline-none w-28 text-foreground"
              disabled={saving}
            />
            <button onClick={handleSave} disabled={saving} className="ml-1 text-primary hover:opacity-70">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => setEditing(false)} disabled={saving} className="text-muted-foreground hover:opacity-70">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setEditing(true)}>
            <p className="text-2xl font-bold">R$ {value.toFixed(2)}</p>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
