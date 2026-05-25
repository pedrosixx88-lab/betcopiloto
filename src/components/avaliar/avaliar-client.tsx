'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import {
  ScanSearch, Upload, Loader2, Crown, AlertTriangle,
  ShieldCheck, ShieldAlert, ShieldQuestion, TrendingUp,
  Banknote, ChevronDown, ChevronUp, X, Sparkles,
} from 'lucide-react'

interface LegAnalysis {
  jogo: string
  selecao: string
  odd: number
  avaliacao: 'FAVORÁVEL' | 'NEUTRO' | 'DESFAVORÁVEL' | 'DADOS INSUFICIENTES'
  confianca: string
  pontos: string[]
  veredicto: string
  justificativa?: string
  alerta: string | null
}

interface AvaliacaoResult {
  legs: LegAnalysis[]
  resumo: {
    jogos_favoraveis: number
    jogos_neutros: number
    jogos_desfavoraveis: number
    jogos_sem_dados: number
    probabilidade_estimada: string
    odd_total: number
    tem_valor: boolean
    nota_geral: string
    parecer: string
  }
  gestao_banca: {
    stake_sugerido: number
    percentual_banca: string
    raciocinio: string
  }
  alertas_gerais: string[]
}

const AVALIACAO_CONFIG = {
  'FAVORÁVEL':           { icon: ShieldCheck,   color: 'text-primary',     bg: 'border-primary/30 bg-primary/5' },
  'NEUTRO':              { icon: ShieldQuestion, color: 'text-yellow-400',  bg: 'border-yellow-400/30 bg-yellow-400/5' },
  'DESFAVORÁVEL':        { icon: ShieldAlert,    color: 'text-destructive', bg: 'border-destructive/30 bg-destructive/5' },
  'DADOS INSUFICIENTES': { icon: ShieldQuestion, color: 'text-muted-foreground', bg: 'border-border bg-secondary/50' },
}

interface Props {
  isPro: boolean
  podeUsarGratis: boolean
  avaliacoesUsadas: number
}

export default function AvaliarClient({ isPro, podeUsarGratis, avaliacoesUsadas }: Props) {
  const [avaliando, setAvaliando] = useState(false)
  const [resultado, setResultado] = useState<AvaliacaoResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [expandedLeg, setExpandedLeg] = useState<number | null>(0)
  const [trialEsgotado, setTrialEsgotado] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const podeAvaliar = isPro || (podeUsarGratis && !trialEsgotado)

  async function avaliarBilhete(file: File) {
    setAvaliando(true)
    setResultado(null)
    setPreviewUrl(URL.createObjectURL(file))

    try {
      const formData = new FormData()
      formData.append('screenshot', file)
      const res = await fetch('/api/bilhete/avaliar', { method: 'POST', body: formData })
      const json = await res.json()

      if (json.success) {
        setResultado(json.analysis)
        if (!isPro) setTrialEsgotado(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (json.error === 'upgrade_required') {
        toast.error('Você já usou sua avaliação gratuita. Assine o Pro para continuar.')
      } else {
        toast.error(json.error ?? 'Erro ao avaliar bilhete')
        setPreviewUrl(null)
      }
    } catch {
      toast.error('Erro de conexão')
      setPreviewUrl(null)
    } finally {
      setAvaliando(false)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) avaliarBilhete(file)
    e.target.value = ''
  }

  // ── RESULTADO ──
  if (resultado) {
    const r = resultado.resumo
    const gb = resultado.gestao_banca
    return (
      <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
        <div className="pt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Análise completa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{resultado.legs.length} seleções analisadas</p>
          </div>
          <button
            onClick={() => { setResultado(null); setPreviewUrl(null) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2"
          >
            <X className="h-3.5 w-3.5" /> Nova análise
          </button>
        </div>

        {/* Resumo */}
        <Card className={cn('border', r.tem_valor ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5')}>
          <CardContent className="py-4 px-4 space-y-3">
            {/* Nota + veredicto */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-background/60 flex flex-col items-center justify-center shrink-0">
                <p className="text-2xl font-bold leading-none">{r.nota_geral?.split('/')[0]}</p>
                <p className="text-[10px] text-muted-foreground">de 10</p>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold leading-snug">{r.parecer}</p>
                <p className={cn('text-xs font-medium mt-1', r.tem_valor ? 'text-primary' : 'text-destructive')}>
                  {r.tem_valor ? '✓ Bilhete com valor' : '✗ Bilhete sem valor'}
                  {r.odd_total ? ` · Odd ${r.odd_total}x` : ''}
                </p>
              </div>
            </div>

            {/* Placar das seleções */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-border/30 pt-3">
              <div className="bg-primary/10 rounded-lg py-2">
                <p className="text-primary font-bold text-xl">{r.jogos_favoraveis}</p>
                <p className="text-muted-foreground">✓ Favoráveis</p>
              </div>
              <div className="bg-yellow-400/10 rounded-lg py-2">
                <p className="text-yellow-400 font-bold text-xl">{r.jogos_neutros}</p>
                <p className="text-muted-foreground">~ Neutras</p>
              </div>
              <div className="bg-destructive/10 rounded-lg py-2">
                <p className="text-destructive font-bold text-xl">{r.jogos_desfavoraveis}</p>
                <p className="text-muted-foreground">✗ Ruins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Por jogo */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Análise por seleção</p>
          {resultado.legs.map((leg, i) => {
            const cfg = AVALIACAO_CONFIG[leg.avaliacao] ?? AVALIACAO_CONFIG['DADOS INSUFICIENTES']
            const Icon = cfg.icon
            const open = expandedLeg === i
            return (
              <Card key={i} className={cn('border', cfg.bg)}>
                <button className="w-full text-left" onClick={() => setExpandedLeg(open ? null : i)}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', cfg.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{leg.jogo}</p>
                        <p className="text-sm font-semibold">{leg.selecao} <span className="text-primary font-bold">@ {leg.odd}x</span></p>
                        <p className={cn('text-xs font-medium mt-0.5', cfg.color)}>{leg.avaliacao} · Confiança {leg.confianca}</p>
                      </div>
                      {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                  </CardContent>
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                    {/* Veredicto */}
                    {leg.veredicto && (
                      <p className={cn('text-sm font-semibold', cfg.color)}>{leg.veredicto}</p>
                    )}
                    {/* Bullets */}
                    {(leg.pontos?.length > 0) && (
                      <ul className="space-y-1.5">
                        {leg.pontos.map((ponto, j) => (
                          <li key={j} className="text-sm text-foreground/80 leading-snug">{ponto}</li>
                        ))}
                      </ul>
                    )}
                    {/* Fallback texto antigo */}
                    {!leg.pontos?.length && leg.justificativa && (
                      <p className="text-sm text-foreground/80">{leg.justificativa}</p>
                    )}
                    {/* Alerta */}
                    {leg.alerta && (
                      <div className="flex items-start gap-2 bg-yellow-400/10 rounded-lg p-2.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-400">{leg.alerta}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        {/* Gestão de banca */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" /> Gestão de banca
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stake sugerido</span>
              <span className="font-bold text-primary">R$ {gb.stake_sugerido?.toFixed(2)} ({gb.percentual_banca})</span>
            </div>
            <p className="text-xs text-muted-foreground">{gb.raciocinio}</p>
          </CardContent>
        </Card>

        {/* Alertas gerais */}
        {resultado.alertas_gerais?.length > 0 && (
          <Card className="border-yellow-400/20 bg-yellow-400/5">
            <CardContent className="py-3 px-4 space-y-1.5">
              {resultado.alertas_gerais.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">{a}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          Análise baseada em dados reais da API. Não é garantia de resultado. Aposte com responsabilidade.
        </p>
      </div>
    )
  }

  // ── TELA UPLOAD (carregando) ──
  if (avaliando || previewUrl) {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <div className="pt-2 mb-4">
          <h1 className="text-xl font-bold">Avaliador de bilhete</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            {previewUrl && (
              <img src={previewUrl} alt="Bilhete" className="max-h-48 mx-auto rounded-lg object-contain mb-2" />
            )}
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium">Analisando seu bilhete...</p>
            <p className="text-xs text-muted-foreground">Buscando escalações, lesões, forma e previsões da API</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── PAYWALL (free já usou o trial) ──
  if (!podeAvaliar) {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto space-y-5">
        <div className="pt-2">
          <h1 className="text-xl font-bold">Avaliador de bilhete</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Análise completa com dados reais</p>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-8 px-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Crown className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg">Você já usou seu teste grátis</p>
              <p className="text-sm text-muted-foreground mt-2">
                O avaliador de bilhete é exclusivo do plano Pro. Assine para analisar quantos bilhetes quiser com dados reais de escalação, lesões, forma e previsão Poisson.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left">
              {[
                { icon: ShieldCheck, text: 'Escalação confirmada' },
                { icon: AlertTriangle, text: 'Lesões e desfalques' },
                { icon: TrendingUp, text: 'Previsão com Poisson' },
                { icon: Banknote, text: 'Quanto apostar' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2 bg-background rounded-lg p-2.5">
                  <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs">{text}</span>
                </div>
              ))}
            </div>

            <Link
              href="/planos"
              className={cn(buttonVariants({ size: 'lg' }), 'w-full gap-2')}
            >
              <Crown className="h-4 w-4" />
              Assinar Pro — R$ 49/mês
            </Link>
            <p className="text-xs text-muted-foreground">Cancele quando quiser</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── TELA PRINCIPAL (pode usar) ──
  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-5">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Avaliador de bilhete</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Análise completa com dados reais antes de apostar
        </p>
      </div>

      {/* Badge free trial */}
      {!isPro && podeUsarGratis && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm text-primary font-medium">
            1 análise gratuita disponível — experimente agora
          </p>
        </div>
      )}

      {/* Upload */}
      <Card className="border-dashed border-primary/40">
        <CardContent className="py-10 px-6 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <ScanSearch className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-base">Envie o print do seu bilhete</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tire um print do bilhete na sua casa de apostas. A IA analisa cada seleção com dados reais da API de futebol.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(buttonVariants({ size: 'lg' }), 'w-full gap-2')}
          >
            <Upload className="h-4 w-4" />
            Escolher imagem
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </CardContent>
      </Card>

      {/* O que analisa */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">O que a IA analisa</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: ShieldCheck, title: 'Escalação confirmada', desc: 'Titulares e formação de cada time' },
            { icon: AlertTriangle, title: 'Lesões e desfalques', desc: 'Jogadores fora da partida' },
            { icon: TrendingUp, title: 'Previsão Poisson', desc: '% vitória/empate/derrota pela API' },
            { icon: ShieldCheck, title: 'Posição na tabela', desc: 'Forma recente e pontuação' },
            { icon: ShieldAlert, title: 'Força ataque/defesa', desc: 'Comparativo entre os times' },
            { icon: Banknote, title: 'Gestão de banca', desc: 'Stake ideal para o bilhete' },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-xs font-semibold">{title}</p>
              </div>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          As análises são baseadas em dados estatísticos e têm caráter <strong className="text-foreground">exclusivamente informativo</strong>. Não garantimos acerto e não nos responsabilizamos por perdas financeiras. Aposte com responsabilidade. +18.
        </p>
      </div>
    </div>
  )
}
