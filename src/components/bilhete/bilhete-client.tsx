'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Ticket, Loader2, AlertTriangle, TrendingUp,
  CheckCircle2, Trophy, X, Clock, Calendar,
  Upload, ScanSearch, ShieldCheck, ShieldAlert, ShieldQuestion,
  ChevronDown, ChevronUp, Banknote
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MARKET_LABELS_SHORT as MARKET_LABELS_MAP, translateSelection } from '@/lib/labels'

interface Game {
  fixture_id: number; home_team: string; away_team: string
  league: string; country: string; time: string; status: string
}
interface Day { date: string; label: string; games: Game[] }
interface TicketSelection {
  fixture_id: number; home_team: string; away_team: string
  market: string; selection: string; reasoning: string; odd?: string | null
}
interface TicketResult {
  selections: TicketSelection[]; stake_suggested: number; confidence: string; alerts: string[]
}

interface LegAnalysis {
  jogo: string; selecao: string; odd: number
  avaliacao: 'FAVORÁVEL' | 'NEUTRO' | 'DESFAVORÁVEL' | 'DADOS INSUFICIENTES'
  confianca: string; justificativa: string; alerta: string | null
}
interface AvaliacaoResult {
  legs: LegAnalysis[]
  resumo: {
    jogos_favoraveis: number; jogos_neutros: number; jogos_desfavoraveis: number
    jogos_sem_dados: number; probabilidade_estimada: string; odd_total: number
    tem_valor: boolean; nota_geral: string; parecer: string
  }
  gestao_banca: { stake_sugerido: number; percentual_banca: string; raciocinio: string }
  alertas_gerais: string[]
}

const AVALIACAO_CONFIG = {
  'FAVORÁVEL':          { icon: ShieldCheck,    color: 'text-primary',     bg: 'bg-primary/10 border-primary/30' },
  'NEUTRO':             { icon: ShieldQuestion,  color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/30' },
  'DESFAVORÁVEL':       { icon: ShieldAlert,     color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30' },
  'DADOS INSUFICIENTES':{ icon: ShieldQuestion,  color: 'text-muted-foreground', bg: 'bg-secondary border-border' },
}

export default function BilheteClient() {
  const [tab, setTab] = useState<'montar' | 'avaliar'>('montar')

  // — Aba Montar —
  const [days, setDays] = useState<Day[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [stake, setStake] = useState('50')
  const [ticket, setTicket] = useState<TicketResult | null>(null)
  const [building, setBuilding] = useState(false)

  // — Aba Avaliar —
  const [avaliando, setAvaliando] = useState(false)
  const [avaliacaoResult, setAvaliacaoResult] = useState<AvaliacaoResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [expandedLeg, setExpandedLeg] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchGames() }, [])
  useEffect(() => { if (ticket) window.scrollTo({ top: 0, behavior: 'smooth' }) }, [ticket])

  async function fetchGames() {
    try {
      const res = await fetch('/api/jogos/hoje')
      const json = await res.json()
      if (json.success) setDays(json.days)
    } catch { toast.error('Erro ao carregar jogos') }
    finally { setLoadingGames(false) }
  }

  function toggleGame(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 8) next.add(id)
      else toast.warning('Máximo 8 jogos por bilhete')
      return next
    })
    setTicket(null)
  }

  async function buildTicket() {
    if (selected.size === 0) { toast.error('Selecione pelo menos 1 jogo'); return }
    const stakeNum = parseFloat(stake)
    if (!stakeNum || stakeNum <= 0) { toast.error('Informe um valor válido'); return }
    setBuilding(true)
    try {
      const res = await fetch('/api/bilhete/montar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stake: stakeNum, fixture_ids: Array.from(selected) }),
      })
      const json = await res.json()
      if (json.success) setTicket(json.ticket)
      else if (json.error === 'upgrade_required') toast.error('Assine o Pro para usar o montador.')
      else toast.error(json.error ?? 'Erro ao montar bilhete')
    } catch { toast.error('Erro de conexão') }
    finally { setBuilding(false) }
  }

  async function avaliarBilhete(file: File) {
    setAvaliando(true)
    setAvaliacaoResult(null)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    try {
      const formData = new FormData()
      formData.append('screenshot', file)
      const res = await fetch('/api/bilhete/avaliar', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.success) {
        setAvaliacaoResult(json.analysis)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (json.error === 'upgrade_required') {
        toast.error('Assine o Pro para usar o avaliador.')
      } else {
        toast.error(json.error ?? 'Erro ao avaliar bilhete')
      }
    } catch { toast.error('Erro de conexão') }
    finally { setAvaliando(false) }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) avaliarBilhete(file)
  }

  const totalGames = days.reduce((acc, d) => acc + d.games.length, 0)

  // ══════════════════════════════════
  // RESULTADO DO MONTADOR
  // ══════════════════════════════════
  if (ticket) {
    return (
      <div className="p-4 space-y-4 pb-24">
        <div className="pt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Bilhete montado</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{ticket.selections.length} seleção{ticket.selections.length > 1 ? 'ões' : ''}</p>
          </div>
          <button onClick={() => { setTicket(null); setSelected(new Set()) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2">
            <X className="h-3.5 w-3.5" /> Novo bilhete
          </button>
        </div>
        {ticket.alerts?.length > 0 && (
          <Card className="border-yellow-400/20 bg-yellow-400/5">
            <CardContent className="py-3 px-4 space-y-1.5">
              {ticket.alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">{a}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Seleções
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-4">
            {ticket.selections.map((s, i) => (
              <div key={i} className="space-y-1 pb-3 border-b border-border last:border-0 last:pb-0">
                <p className="text-xs text-muted-foreground">{s.home_team} vs {s.away_team}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded-md shrink-0">{MARKET_LABELS_MAP[s.market] ?? s.market}</span>
                  <span className="text-sm font-semibold flex-1">{translateSelection(s.selection)}</span>
                  {s.odd && <span className="text-xs font-bold text-primary bg-brand-muted border border-primary/20 px-1.5 py-0.5 rounded shrink-0">{s.odd}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{s.reasoning}</p>
                {s.odd && <p className="text-[10px] text-yellow-400/70">⚠ Odd registrada no momento da análise — verifique na casa de apostas</p>}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-brand-muted">
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stake sugerido</span>
              <span className="font-semibold">R$ {ticket.stake_suggested?.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-primary/20">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-primary font-medium">Confiança {ticket.confidence}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">Consulte as odds reais na sua casa de apostas antes de apostar.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ══════════════════════════════════
  // RESULTADO DO AVALIADOR
  // ══════════════════════════════════
  if (avaliacaoResult) {
    const r = avaliacaoResult.resumo
    const gb = avaliacaoResult.gestao_banca
    return (
      <div className="p-4 space-y-4 pb-24">
        <div className="pt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Análise do bilhete</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{avaliacaoResult.legs.length} seleções analisadas</p>
          </div>
          <button onClick={() => { setAvaliacaoResult(null); setPreviewUrl(null) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2">
            <X className="h-3.5 w-3.5" /> Novo bilhete
          </button>
        </div>

        {/* Resumo geral */}
        <Card className={cn('border', r.tem_valor ? 'border-primary/30 bg-brand-muted' : 'border-yellow-400/30 bg-yellow-400/5')}>
          <CardContent className="py-4 px-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">{r.nota_geral}</p>
                <p className="text-xs text-muted-foreground">Nota geral</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">{r.probabilidade_estimada}</p>
                <p className="text-xs text-muted-foreground">Prob. estimada</p>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-semibold', r.tem_valor ? 'text-primary' : 'text-yellow-400')}>
                  {r.tem_valor ? '✓ Tem valor' : '⚠ Sem valor claro'}
                </p>
                <p className="text-xs text-muted-foreground">Odd: {r.odd_total}x</p>
              </div>
            </div>
            <p className="text-sm text-foreground/80">{r.parecer}</p>
            <div className="flex gap-3 pt-1 border-t border-border/50 text-xs text-center">
              <div className="flex-1">
                <p className="text-primary font-bold text-base">{r.jogos_favoraveis}</p>
                <p className="text-muted-foreground">Favoráveis</p>
              </div>
              <div className="flex-1">
                <p className="text-yellow-400 font-bold text-base">{r.jogos_neutros}</p>
                <p className="text-muted-foreground">Neutros</p>
              </div>
              <div className="flex-1">
                <p className="text-destructive font-bold text-base">{r.jogos_desfavoraveis}</p>
                <p className="text-muted-foreground">Desfavoráveis</p>
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground font-bold text-base">{r.jogos_sem_dados}</p>
                <p className="text-muted-foreground">Sem dados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Análise por jogo */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Análise por jogo</p>
          {avaliacaoResult.legs.map((leg, i) => {
            const cfg = AVALIACAO_CONFIG[leg.avaliacao] ?? AVALIACAO_CONFIG['DADOS INSUFICIENTES']
            const Icon = cfg.icon
            const isOpen = expandedLeg === i
            return (
              <Card key={i} className={cn('border', cfg.bg)}>
                <button className="w-full text-left" onClick={() => setExpandedLeg(isOpen ? null : i)}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', cfg.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{leg.jogo}</p>
                        <p className="text-sm font-semibold">{leg.selecao} <span className="text-primary font-bold">@ {leg.odd}x</span></p>
                        <p className={cn('text-xs font-medium mt-0.5', cfg.color)}>{leg.avaliacao} · Confiança {leg.confianca}</p>
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>
                  </CardContent>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 space-y-2 border-t border-border/30 pt-3">
                    <p className="text-sm text-foreground/80">{leg.justificativa}</p>
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
        <Card className="border-primary/20 bg-brand-muted">
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
        {avaliacaoResult.alertas_gerais?.length > 0 && (
          <Card className="border-yellow-400/20 bg-yellow-400/5">
            <CardContent className="py-3 px-4 space-y-1.5">
              {avaliacaoResult.alertas_gerais.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">{a}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <p className="text-[10px] text-muted-foreground text-center px-4">
          Análise baseada em dados reais da API. Não é garantia de resultado. Aposte com responsabilidade.
        </p>
      </div>
    )
  }

  // ══════════════════════════════════
  // TELA PRINCIPAL COM TABS
  // ══════════════════════════════════
  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="pt-2">
        <h1 className="text-xl font-bold">Bilhete</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Montar ou avaliar seu bilhete com IA</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {(['montar', 'avaliar'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5',
              tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            )}>
            {t === 'montar' ? <><Ticket className="h-3.5 w-3.5" /> Montar</> : <><ScanSearch className="h-3.5 w-3.5" /> Avaliar</>}
          </button>
        ))}
      </div>

      {/* ── ABA MONTAR ── */}
      {tab === 'montar' && (
        <div className="space-y-4">
          {loadingGames && (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Carregando jogos...</span>
            </div>
          )}
          {!loadingGames && totalGames === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center space-y-2">
                <Trophy className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">Nenhum jogo disponível</p>
                <p className="text-xs text-muted-foreground">Sem jogos nos próximos dias.</p>
              </CardContent>
            </Card>
          )}
          {selected.size > 0 && (
            <Card className="border-primary/30 bg-brand-muted sticky top-16 z-10">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-primary">{selected.size} jogo{selected.size > 1 ? 's' : ''} selecionado{selected.size > 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted-foreground">Máximo 8 jogos</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" value={stake} onChange={e => setStake(e.target.value)}
                    placeholder="R$ 50"
                    className="w-24 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50" />
                  <Button size="sm" onClick={buildTicket} disabled={building} className="gap-1.5">
                    {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ticket className="h-3.5 w-3.5" />}
                    {building ? 'Montando...' : 'Montar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {days.map(day => {
            const byLeague: Record<string, Game[]> = {}
            for (const g of day.games) {
              const key = `${g.country} — ${g.league}`
              if (!byLeague[key]) byLeague[key] = []
              byLeague[key].push(g)
            }
            return (
              <div key={day.date} className="space-y-3">
                <div className="flex items-center gap-2 pt-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-bold capitalize">{day.label}</h2>
                  <span className="text-xs text-muted-foreground">({day.games.length} jogos)</span>
                </div>
                {Object.entries(byLeague).map(([leagueKey, leagueGames]) => (
                  <div key={leagueKey} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-1">
                      <Trophy className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{leagueKey}</p>
                    </div>
                    {leagueGames.map(g => {
                      const isSelected = selected.has(g.fixture_id)
                      const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(g.status)
                      return (
                        <button key={g.fixture_id} onClick={() => toggleGame(g.fixture_id)}
                          className={cn('w-full text-left rounded-xl border p-3 transition-all',
                            isSelected ? 'border-primary bg-brand-muted' : 'bg-card border-border hover:border-primary/30'
                          )}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{g.home_team} <span className="text-muted-foreground font-normal">vs</span> {g.away_team}</p>
                              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                {isLive ? <span className="text-green-400 font-semibold animate-pulse">● Ao vivo</span>
                                  : <><Clock className="h-3 w-3" /><span>{g.time}</span></>}
                              </div>
                            </div>
                            <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                              isSelected ? 'border-primary bg-primary' : 'border-border')}>
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ── ABA AVALIAR ── */}
      {tab === 'avaliar' && (
        <div className="space-y-4">
          <Card className="border-dashed border-primary/30">
            <CardContent className="py-8 px-6 text-center space-y-4">
              {avaliando ? (
                <div className="space-y-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm font-medium">Analisando seu bilhete...</p>
                  <p className="text-xs text-muted-foreground">Buscando escalações, desfalques, forma e previsões da API</p>
                </div>
              ) : previewUrl ? (
                <div className="space-y-3">
                  <img src={previewUrl} alt="Bilhete" className="max-h-48 mx-auto rounded-lg object-contain" />
                  <p className="text-xs text-muted-foreground">Processando...</p>
                </div>
              ) : (
                <>
                  <ScanSearch className="h-10 w-10 text-primary mx-auto" />
                  <div>
                    <p className="font-semibold">Avalie seu bilhete com IA</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tire um print do seu bilhete na casa de apostas e a IA analisa cada seleção com dados reais: escalação, lesões, forma, tabela e probabilidades.
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={cn('w-full py-3 rounded-xl font-semibold text-sm transition-all',
                      'bg-primary text-primary-foreground hover:bg-primary/90'
                    )}
                  >
                    <Upload className="h-4 w-4 inline mr-2" />
                    Enviar print do bilhete
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  <div className="grid grid-cols-2 gap-2 pt-1 text-left">
                    {[
                      { icon: ShieldCheck, text: 'Escalação confirmada', color: 'text-primary' },
                      { icon: AlertTriangle, text: 'Lesões e desfalques', color: 'text-yellow-400' },
                      { icon: TrendingUp, text: 'Previsão com Poisson', color: 'text-primary' },
                      { icon: Banknote, text: 'Quanto apostar', color: 'text-primary' },
                    ].map(({ icon: Icon, text, color }, i) => (
                      <div key={i} className="flex items-center gap-2 bg-secondary rounded-lg p-2.5">
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
                        <span className="text-xs">{text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
