'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Upload, Camera, Loader2, ChevronLeft, CheckCircle,
  ImageIcon, PenLine
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Market = 'match_winner' | 'over_under' | 'both_teams_score' | 'handicap' | 'correct_score' | 'other'

const MARKET_LABELS: Record<Market, string> = {
  match_winner: 'Resultado final (1X2)',
  over_under: 'Mais/Menos gols',
  both_teams_score: 'Ambas marcam',
  handicap: 'Handicap',
  correct_score: 'Placar exato',
  other: 'Outro',
}

interface BetForm {
  home_team: string
  away_team: string
  league: string
  market: Market
  selection: string
  odd: string
  stake: string
  potential_return: string
  match_date: string
  bookmaker: string
  screenshot_url: string
}

const EMPTY_FORM: BetForm = {
  home_team: '', away_team: '', league: '', market: 'match_winner',
  selection: '', odd: '', stake: '', potential_return: '',
  match_date: new Date().toISOString().split('T')[0],
  bookmaker: '', screenshot_url: '',
}

export default function NovaApostaPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'form'>('upload')
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [form, setForm] = useState<BetForm>(EMPTY_FORM)

  function updateForm(field: keyof BetForm, value: string) {
    setForm(prev => {
      const updated = { ...prev, [field]: value }
      // Recalcula retorno potencial automaticamente
      if (field === 'odd' || field === 'stake') {
        const odd = parseFloat(field === 'odd' ? value : prev.odd) || 0
        const stake = parseFloat(field === 'stake' ? value : prev.stake) || 0
        if (odd > 0 && stake > 0) {
          updated.potential_return = (odd * stake).toFixed(2)
        }
      }
      return updated
    })
  }

  async function handleFile(file: File) {
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setExtracting(true)

    const fd = new FormData()
    fd.append('screenshot', file)

    try {
      const res = await fetch('/api/apostas/extrair', { method: 'POST', body: fd })
      const json = await res.json()

      if (json.success && json.data) {
        const d = json.data
        setForm({
          home_team: d.home_team ?? '',
          away_team: d.away_team ?? '',
          league: d.league ?? '',
          market: d.market ?? 'match_winner',
          selection: d.selection ?? '',
          odd: String(d.odd ?? ''),
          stake: String(d.stake ?? ''),
          potential_return: String(d.potential_return ?? ''),
          match_date: d.match_date ?? EMPTY_FORM.match_date,
          bookmaker: d.bookmaker ?? '',
          screenshot_url: json.screenshot_url ?? '',
        })
        toast.success('Bilhete lido com sucesso! Confirme os dados.')
      } else {
        setForm(prev => ({ ...prev, screenshot_url: json.screenshot_url ?? '' }))
        toast.warning(json.error ?? 'Preencha os dados manualmente.')
      }
    } catch {
      toast.error('Erro ao processar imagem. Tente novamente.')
    } finally {
      setExtracting(false)
      setStep('form')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function handleSave() {
    if (!form.home_team || !form.away_team) { toast.error('Preencha os times'); return }
    if (!form.odd || !form.stake) { toast.error('Preencha odd e valor apostado'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/apostas/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          odd: parseFloat(form.odd),
          stake: parseFloat(form.stake),
          potential_return: parseFloat(form.potential_return) || parseFloat(form.odd) * parseFloat(form.stake),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      toast.success('Aposta registrada!')
      router.push('/apostas')
    } catch {
      toast.error('Erro ao salvar aposta. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => step === 'form' ? setStep('upload') : router.back()}
          className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Nova aposta</h1>
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tire print do seu bilhete e a IA extrai tudo automaticamente.
          </p>

          {/* Drag & Drop */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-brand-muted transition-all space-y-3"
          >
            <div className="w-14 h-14 rounded-full bg-brand-muted flex items-center justify-center mx-auto">
              <ImageIcon className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-medium">Arraste o print aqui</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG ou WebP • Máx. 10MB</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleInputChange}
            capture="environment"
          />

          {/* Câmera no mobile */}
          <Button
            className="w-full gap-2"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute('capture', 'environment')
                fileInputRef.current.click()
              }
            }}
          >
            <Camera className="h-4 w-4" />
            Tirar foto do bilhete
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => { setForm(EMPTY_FORM); setStep('form') }}
          >
            <PenLine className="h-4 w-4" />
            Preencher manualmente
          </Button>
        </div>
      )}

      {/* Loading de extração */}
      {extracting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-64">
            <CardContent className="py-8 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="font-medium">Lendo o bilhete...</p>
              <p className="text-sm text-muted-foreground">A IA está extraindo os dados</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step: Formulário */}
      {step === 'form' && (
        <div className="space-y-5">
          {/* Preview da imagem */}
          {preview && (
            <div className="relative rounded-xl overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview do bilhete" className="w-full max-h-48 object-cover" />
              <div className="absolute top-2 right-2">
                <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Lido pela IA
                </span>
              </div>
            </div>
          )}

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Time da casa</Label>
              <Input placeholder="Ex: Flamengo" value={form.home_team}
                onChange={e => updateForm('home_team', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Time visitante</Label>
              <Input placeholder="Ex: Palmeiras" value={form.away_team}
                onChange={e => updateForm('away_team', e.target.value)} />
            </div>
          </div>

          {/* Liga */}
          <div className="space-y-1.5">
            <Label>Liga <span className="text-muted-foreground">(opcional)</span></Label>
            <Input placeholder="Ex: Brasileirão Série A" value={form.league}
              onChange={e => updateForm('league', e.target.value)} />
          </div>

          {/* Mercado */}
          <div className="space-y-1.5">
            <Label>Mercado</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(MARKET_LABELS) as Market[]).map(m => (
                <button key={m} onClick={() => updateForm('market', m)}
                  className={cn(
                    'p-2.5 rounded-lg border text-xs text-left transition-all',
                    form.market === m
                      ? 'border-primary bg-brand-muted text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-border/80'
                  )}>
                  {MARKET_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Seleção */}
          <div className="space-y-1.5">
            <Label>Seleção</Label>
            <Input placeholder="Ex: Flamengo vence, Over 2.5..." value={form.selection}
              onChange={e => updateForm('selection', e.target.value)} />
          </div>

          {/* Odd + Stake + Retorno */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Odd</Label>
              <Input type="number" step="0.01" min="1" placeholder="1.85"
                value={form.odd} onChange={e => updateForm('odd', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" placeholder="50.00"
                value={form.stake} onChange={e => updateForm('stake', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Retorno</Label>
              <Input type="number" step="0.01" min="0" placeholder="92.50"
                value={form.potential_return}
                onChange={e => updateForm('potential_return', e.target.value)}
                className="bg-muted/30" />
            </div>
          </div>

          {/* Data + Casa */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data do jogo</Label>
              <Input type="date" value={form.match_date}
                onChange={e => updateForm('match_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Casa de aposta</Label>
              <Input placeholder="Ex: Betano" value={form.bookmaker}
                onChange={e => updateForm('bookmaker', e.target.value)} />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2 pb-6">
            <Button variant="outline" className="flex-1"
              onClick={() => { setPreview(null); setStep('upload') }}>
              Voltar
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                : <><Upload className="h-4 w-4" /> Registrar aposta</>
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
