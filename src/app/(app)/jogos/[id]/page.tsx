'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft, Brain, MessageCircle, Send, Loader2,
  AlertTriangle, Ticket, TrendingUp, CheckCircle2, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Market {
  market: string
  selection: string
  reasoning: string
  confidence: 'alta' | 'média' | 'baixa'
  odd?: string | null
}

interface Summary {
  tip: string
  confidence: 'alta' | 'média' | 'baixa'
  markets: Market[]
}

interface Analysis {
  analysis: string
  summary: Summary
  home_team: string
  away_team: string
  league: string
  cached: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface TicketSelection {
  fixture_id: number
  home_team: string
  away_team: string
  market: string
  selection: string
  reasoning: string
  odd?: string | null
}

interface Ticket {
  selections: TicketSelection[]
  stake_suggested: number
  confidence: string
  alerts: string[]
}

const CONFIDENCE_COLOR = {
  alta: 'text-primary border-primary/30 bg-brand-muted',
  média: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  baixa: 'text-muted-foreground border-border bg-muted/30',
}

const MARKET_LABELS: Record<string, string> = {
  match_winner: '1X2',
  over_under: 'Mais/Menos Gols',
  both_teams_score: 'Ambas marcam',
  corners: 'Escanteios',
  cards: 'Cartões',
  handicap: 'Handicap',
  correct_score: 'Placar exato',
  other: 'Outro',
}

export default function JogoPage() {
  const params = useParams()
  const router = useRouter()
  const fixtureId = params.id as string

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [tab, setTab] = useState<'analise' | 'chat' | 'bilhete'>('analise')

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [stake, setStake] = useState('50')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loadingTicket, setLoadingTicket] = useState(false)

  useEffect(() => { fetchAnalysis() }, [fixtureId])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function fetchAnalysis(refresh = false) {
    setLoadingAnalysis(true)
    try {
      const url = `/api/jogos/${fixtureId}/analisar${refresh ? '?refresh=1' : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) {
        setAnalysis(json)
        if (!json.cached) toast.success(refresh ? 'Análise atualizada com odds frescas!' : 'Análise gerada pela IA!')
      } else {
        toast.error(json.error ?? 'Erro ao carregar análise')
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoadingAnalysis(false)
    }
  }

  async function sendMessage() {
    if (!input.trim()) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const res = await fetch(`/api/jogos/${fixtureId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, history: messages }),
      })
      const json = await res.json()
      if (json.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
      }
    } catch {
      toast.error('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  async function buildTicket() {
    const stakeNum = parseFloat(stake)
    if (!stakeNum || stakeNum <= 0) { toast.error('Informe um valor válido'); return }
    setLoadingTicket(true)
    try {
      const res = await fetch('/api/bilhete/montar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stake: stakeNum, fixture_ids: [parseInt(fixtureId)] }),
      })
      const json = await res.json()
      if (json.success) setTicket(json.ticket)
      else toast.error(json.error ?? 'Erro ao montar bilhete')
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoadingTicket(false)
    }
  }

  const title = analysis ? `${analysis.home_team} vs ${analysis.away_team}` : 'Carregando...'

  return (
    <div className="min-h-screen max-w-lg mx-auto flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center gap-3 pt-6 shrink-0">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate">{title}</h1>
          {analysis && <p className="text-xs text-muted-foreground">{analysis.league}</p>}
        </div>
        {analysis && !loadingAnalysis && (
          <button
            onClick={() => fetchAnalysis(true)}
            className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            title="Atualizar análise com odds frescas"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 shrink-0">
        {(['analise', 'chat', 'bilhete'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 text-xs font-medium rounded-lg transition-all border',
              tab === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/30'
            )}>
            {t === 'analise' ? '🧠 Análise' : t === 'chat' ? '💬 Chat' : '🎫 Bilhete'}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">

        {/* Tab: Análise */}
        {tab === 'analise' && (
          <>
            {loadingAnalysis && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Gerando análise com IA...</p>
                <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
              </div>
            )}

            {analysis && !loadingAnalysis && (
              <>
                {/* Tip principal */}
                <Card className="border-primary/20 bg-brand-muted">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-primary">Tip principal</p>
                          <Badge className={cn('text-[10px] border', CONFIDENCE_COLOR[analysis.summary.confidence])}>
                            {analysis.summary.confidence}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium mt-1">{analysis.summary.tip}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Mercados */}
                {analysis.summary.markets?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm">Mercados analisados</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-3">
                      {analysis.summary.markets.map((m, i) => (
                        <div key={i} className="space-y-1 pb-3 border-b border-border last:border-0 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">{MARKET_LABELS[m.market] ?? m.market}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {m.odd && (
                                <span className="text-xs font-bold text-primary bg-brand-muted border border-primary/20 px-1.5 py-0.5 rounded">
                                  {m.odd}
                                </span>
                              )}
                              <Badge className={cn('text-[10px] border', CONFIDENCE_COLOR[m.confidence])}>
                                {m.confidence}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm font-medium">{m.selection}</p>
                          <p className="text-xs text-muted-foreground">{m.reasoning}</p>
                          {m.odd && (
                            <p className="text-[10px] text-yellow-400/70">⚠ Odd registrada no momento da análise — verifique o valor atual na Bet365</p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Análise completa */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm">Análise completa</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {analysis.analysis}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* Tab: Chat */}
        {tab === 'chat' && (
          <div className="flex flex-col h-full space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">Pergunte sobre o jogo</p>
                <p className="text-xs text-muted-foreground">Ex: "Qual o histórico recente do time da casa?"</p>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card border border-border rounded-bl-sm'
                  )}>
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="sticky bottom-0 bg-background pt-2 pb-4">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Pergunte sobre o jogo..."
                  className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
                <Button size="sm" onClick={sendMessage} disabled={sending || !input.trim()} className="shrink-0 h-10 w-10 p-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Bilhete */}
        {tab === 'bilhete' && (
          <div className="space-y-4">
            {!analysis && !loadingAnalysis && (
              <Card className="border-yellow-400/20 bg-yellow-400/5">
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
                  <p className="text-sm text-yellow-400">Aguarde a análise carregar primeiro.</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="py-4 px-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Valor disponível (R$)</label>
                  <input
                    type="number"
                    min="1"
                    value={stake}
                    onChange={e => setStake(e.target.value)}
                    placeholder="50.00"
                    className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                  />
                </div>
                <Button className="w-full gap-2" onClick={buildTicket} disabled={loadingTicket || !analysis}>
                  {loadingTicket
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Montando bilhete...</>
                    : <><Ticket className="h-4 w-4" /> Montar bilhete com IA</>
                  }
                </Button>
              </CardContent>
            </Card>

            {ticket && (
              <>
                {/* Alertas */}
                {ticket.alerts?.length > 0 && (
                  <Card className="border-yellow-400/20 bg-yellow-400/5">
                    <CardContent className="py-3 px-4 space-y-1">
                      {ticket.alerts.map((a, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-yellow-400">{a}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Seleções */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Bilhete sugerido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-3">
                    {ticket.selections.map((s, i) => (
                      <div key={i} className="space-y-0.5 pb-3 border-b border-border last:border-0 last:pb-0">
                        <p className="text-xs text-muted-foreground">{s.home_team} vs {s.away_team}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-secondary px-2 py-0.5 rounded-md shrink-0">{MARKET_LABELS[s.market] ?? s.market}</span>
                          <span className="text-sm font-medium flex-1">{s.selection}</span>
                          {s.odd && (
                            <span className="text-xs font-bold text-primary bg-brand-muted border border-primary/20 px-1.5 py-0.5 rounded shrink-0">
                              {s.odd}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{s.reasoning}</p>
                        {s.odd && (
                          <p className="text-[10px] text-yellow-400/70">⚠ Odd registrada no momento da análise — verifique na Bet365</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Resumo */}
                <Card className="border-primary/20 bg-brand-muted">
                  <CardContent className="py-3 px-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stake sugerido</span>
                      <span className="font-semibold">R$ {ticket.stake_suggested?.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 border-t border-primary/20 pt-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs text-primary">Confiança {ticket.confidence}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Consulte as odds reais na sua casa de apostas antes de apostar.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
