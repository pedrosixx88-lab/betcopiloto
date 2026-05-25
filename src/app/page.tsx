import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronRight, Smartphone } from 'lucide-react'

const APK_URL = 'https://qwciyudbovdiadnxweac.supabase.co/storage/v1/object/public/downloads/BetCopiloto.apk'

const FEATURES = [
  {
    num: '01',
    title: 'Print → Aposta em 3s',
    desc: 'Fotografe seu bilhete. A IA lê times, mercado, odd e valor automaticamente. Zero digitação.',
    badge: 'IA Vision',
    stat: '3s',
    statLabel: 'para registrar',
  },
  {
    num: '02',
    title: 'Dashboard com ROI real',
    desc: 'Win rate por mercado, lucro acumulado e evolução da banca. Os dados que as casas escondem de você.',
    badge: 'Grátis',
    stat: '64%',
    statLabel: 'win rate médio',
  },
  {
    num: '03',
    title: 'Análise profunda por jogo',
    desc: 'Forma recente, confrontos diretos, desfalques e odds analisados pela IA antes de você apostar.',
    badge: 'Pro',
    stat: '5+',
    statLabel: 'mercados por jogo',
  },
  {
    num: '04',
    title: 'Avalie seu bilhete',
    desc: 'Sobe o print do bilhete antes de confirmar. A IA analisa cada seleção e diz se vale a pena apostar.',
    badge: 'Grátis',
    stat: '1',
    statLabel: 'grátis por conta',
  },
  {
    num: '05',
    title: 'Briefing diário às 9h',
    desc: 'Todo dia de manhã você recebe os melhores jogos do dia selecionados pela IA direto no celular.',
    badge: 'Pro',
    stat: '9h',
    statLabel: 'todo dia',
  },
  {
    num: '06',
    title: 'Programa de afiliados',
    desc: 'Indique amigos e ganhe 30% de comissão recorrente em cada assinatura. Pagamento via Pix todo mês.',
    badge: 'Afiliado',
    stat: '30%',
    statLabel: 'recorrente',
  },
]

const TESTIMONIALS = [
  {
    name: 'Rafael Mendonça',
    role: 'Apostador há 3 anos · São Paulo',
    text: 'Em 2 meses descobri que tinha 68% de win rate no mercado de over/under e nem sabia. Agora foco só nisso.',
    roi: '+31% ROI',
  },
  {
    name: 'Lucas Ferreira',
    role: 'Apostador esportivo · Belo Horizonte',
    text: 'O briefing das 9h virou ritual. Chego no trabalho já sabendo quais jogos vale analisar à noite.',
    roi: '+18% ROI',
  },
  {
    name: 'André Pacheco',
    role: 'Apostador de fim de semana · Rio de Janeiro',
    text: 'Nunca mais digitei nada manualmente. Tiro o print e em 3 segundos a aposta está registrada.',
    roi: '-40% erros',
  },
]

const FREE_FEATURES = [
  'Registro ilimitado de apostas',
  'Dashboard com métricas e ROI',
  'Lista de jogos do dia',
  'Avaliação de bilhete (1 grátis)',
  'Briefing diário (sem push)',
]

const PRO_FEATURES = [
  'Tudo do plano Free',
  'Análise completa de cada jogo com IA',
  'Avaliações de bilhete ilimitadas',
  'Push notification do briefing',
  'Suporte prioritário',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <style>{`
        :root {
          --green: oklch(0.63 0.19 145);
          --green-dim: oklch(0.63 0.19 145 / 0.12);
          --green-border: oklch(0.63 0.19 145 / 0.25);
          --green-glow: oklch(0.63 0.19 145 / 0.4);
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 var(--green-glow); }
          50%       { box-shadow: 0 0 0 10px transparent; }
        }
        .fu  { animation: fadeUp .65s ease both; }
        .fu1 { animation: fadeUp .65s .1s ease both; }
        .fu2 { animation: fadeUp .65s .2s ease both; }
        .fu3 { animation: fadeUp .65s .35s ease both; }
        .pulse { animation: pulse-ring 2.4s infinite; }
        .ticker-wrap { overflow: hidden; }
        .ticker { display: flex; animation: ticker 32s linear infinite; width: max-content; }
        .dot-grid {
          background-image: radial-gradient(circle, oklch(0.63 0.19 145 / 0.18) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .hero-glow {
          background: radial-gradient(ellipse 70% 50% at 50% 0%, oklch(0.63 0.19 145 / 0.12) 0%, transparent 70%);
        }
        .card-hover {
          transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
        }
        .card-hover:hover {
          transform: translateY(-3px);
          border-color: var(--green-border);
          box-shadow: 0 12px 40px oklch(0.63 0.19 145 / 0.08);
        }
        .num-badge {
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/6 bg-background/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-lg bg-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 13L7 9L10 12L15 5" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="15" cy="5" r="1.5" fill="black"/>
                </svg>
              </div>
            </div>
            <span className="font-black text-base tracking-tight">BetCopiloto</span>
          </div>

          <div className="hidden sm:flex items-center gap-7 text-sm text-muted-foreground font-medium">
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-muted-foreground hidden sm:flex' })}>
              Entrar
            </Link>
            <Link href="/register" className={cn(buttonVariants({ size: 'sm' }), 'pulse font-bold px-5')}>
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-36 pb-28 px-5 dot-grid">
        <div className="hero-glow absolute inset-0 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">

          {/* Badge */}
          <div className="fu flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/10 text-primary text-xs font-bold px-4 py-2 rounded-full uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              IA generativa para apostas esportivas
            </div>
          </div>

          {/* Headline */}
          <h1 className="fu1 text-center text-[clamp(2.8rem,8vw,5.5rem)] font-black leading-[0.95] tracking-tight mb-6">
            Pare de apostar<br />
            <span className="text-primary">no escuro.</span>
          </h1>

          <p className="fu2 text-center text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            Registre apostas com um print, descubra seu ROI real, avalie bilhetes com IA
            e receba os melhores jogos do dia toda manhã.
          </p>

          {/* CTAs */}
          <div className="fu3 flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link href="/register" className={cn(buttonVariants({ size: 'lg' }), 'h-14 px-10 text-base font-black gap-2')}>
              Criar conta grátis
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="#planos" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-14 px-10 text-base font-semibold border-white/12 hover:border-primary/40')}>
              Ver planos
            </Link>
          </div>

          <div className="fu3 flex justify-center mb-14">
            <a href={APK_URL} download="BetCopiloto.apk"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2 text-muted-foreground hover:text-primary text-xs')}>
              <Smartphone className="h-3.5 w-3.5" />
              Baixar APK para Android
            </a>
          </div>

          {/* Dashboard mockup */}
          <div className="relative max-w-3xl mx-auto">
            {/* Glow atrás */}
            <div className="absolute -inset-4 bg-primary/8 rounded-3xl blur-2xl" />

            <div className="relative rounded-2xl border border-white/10 bg-[oklch(0.11_0_0)] overflow-hidden shadow-[0_32px_80px_oklch(0_0_0/0.6)]">
              {/* Browser bar */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/6 bg-white/2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-white/6 text-[11px] text-muted-foreground px-4 py-1 rounded-full">
                    betcopiloto.com.br/dashboard
                  </div>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-5 sm:p-7 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold">Olá, Rafael 👋</p>
                    <p className="text-xs text-muted-foreground">Sua performance este mês</p>
                  </div>
                  <div className="text-xs font-bold bg-primary/15 text-primary px-3 py-1.5 rounded-lg border border-primary/25 cursor-pointer">
                    + Registrar aposta
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Banca atual',    value: 'R$ 2.840', up: false },
                    { label: 'Lucro total',    value: '+R$ 840',  up: true },
                    { label: 'Win Rate',       value: '64,2%',    up: true },
                    { label: 'ROI',            value: '+31,4%',   up: true },
                  ].map(m => (
                    <div key={m.label} className="bg-background/50 border border-white/6 rounded-xl p-4 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{m.label}</p>
                      <p className={cn('text-xl font-black num-badge', m.up ? 'text-primary' : 'text-foreground')}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Gráfico fake */}
                <div className="bg-background/30 border border-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evolução da banca</p>
                    <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">+42% este mês</span>
                  </div>
                  <div className="flex items-end gap-1.5 h-16">
                    {[35, 42, 38, 55, 48, 62, 58, 70, 65, 78, 72, 88].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm transition-all"
                        style={{
                          height: `${h}%`,
                          background: i >= 10
                            ? 'oklch(0.63 0.19 145)'
                            : `oklch(0.63 0.19 145 / ${0.2 + i * 0.05})`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Briefing */}
                <div className="bg-primary/8 border border-primary/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Briefing do dia</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Real Madrid vs Barcelona</strong> — Clássico com Real favorito em casa, mas Barça chega invicto há 8 jogos...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="border-y border-white/6 py-4 ticker-wrap bg-white/1">
        <div className="ticker">
          {[...Array(2)].map((_, rep) => (
            <div key={rep} className="flex items-center gap-10 px-6">
              {[
                { v: '3 segundos',  l: 'para registrar um bilhete' },
                { v: '+31% ROI',    l: 'média dos usuários Pro' },
                { v: '9h da manhã', l: 'briefing diário com IA' },
                { v: '5+ mercados', l: 'analisados por jogo' },
                { v: '100%',        l: 'automático via print' },
                { v: '30%',         l: 'comissão de afiliados' },
              ].map(s => (
                <div key={s.l + rep} className="flex items-center gap-3 shrink-0">
                  <span className="text-primary font-black text-lg num-badge">{s.v}</span>
                  <span className="text-muted-foreground text-sm">{s.l}</span>
                  <span className="text-white/8 text-xl ml-4">·</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" className="py-28 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-4">Como funciona</p>
            <h2 className="text-4xl sm:text-5xl font-black leading-tight">Simples como<br />tirar uma foto</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-0 relative">
            {/* linha conectora desktop */}
            <div className="hidden sm:block absolute top-9 left-[16.67%] right-[16.67%] h-px"
              style={{ background: 'linear-gradient(90deg, transparent, oklch(0.63 0.19 145 / 0.5), transparent)' }} />

            {([
              {
                n: '01',
                title: 'Tire um print',
                desc: 'Fotografe seu bilhete na Bet365, Betano, ou qualquer casa de apostas.',
                icon: (
                  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="oklch(0.63 0.19 145)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="8" width="24" height="17" rx="2.5"/>
                    <circle cx="15" cy="16.5" r="4.5"/>
                    <circle cx="15" cy="16.5" r="2"/>
                    <path d="M10.5 8l1.8-3.5h5.4l1.8 3.5"/>
                    <circle cx="23" cy="12" r="1" fill="oklch(0.63 0.19 145)" stroke="none"/>
                  </svg>
                ),
              },
              {
                n: '02',
                title: 'IA processa tudo',
                desc: 'Times, mercado, odd e valor extraídos em segundos. Zero digitação.',
                icon: (
                  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="oklch(0.63 0.19 145)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 4h13l5 5v17H6V4z"/>
                    <path d="M19 4v5h5"/>
                    <path d="M10 13h10M10 17h10M10 21h6"/>
                    <path d="M18 21l4 4"/>
                    <circle cx="23" cy="25" r="2"/>
                  </svg>
                ),
              },
              {
                n: '03',
                title: 'Evolua com dados',
                desc: 'ROI real, win rate por mercado e análises IA todo dia de manhã.',
                icon: (
                  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="oklch(0.63 0.19 145)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 22l5.5-6.5 4.5 3.5 5.5-7.5L26 16"/>
                    <path d="M4 26h22"/>
                    <path d="M4 4v22"/>
                    <circle cx="9.5" cy="15.5" r="1.5" fill="oklch(0.63 0.19 145)" stroke="none"/>
                    <circle cx="14" cy="19" r="1.5" fill="oklch(0.63 0.19 145)" stroke="none"/>
                    <circle cx="19.5" cy="11.5" r="1.5" fill="oklch(0.63 0.19 145)" stroke="none"/>
                    <circle cx="26" cy="16" r="1.5" fill="oklch(0.63 0.19 145)" stroke="none"/>
                  </svg>
                ),
              },
            ] as const).map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-5 p-8">
                <div className="relative">
                  <div className="w-[72px] h-[72px] rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                    <span className="text-[9px] font-black text-black">{i + 1}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-primary/50 tracking-[0.25em]">{step.n}</p>
                  <h3 className="font-black text-xl">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px] mx-auto">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="funcionalidades" className="py-28 px-5 border-t border-white/5 dot-grid">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-4">Funcionalidades</p>
            <h2 className="text-4xl sm:text-5xl font-black leading-tight">Tudo que você precisa<br />para apostar melhor</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-hover group bg-[oklch(0.11_0_0)] border border-white/6 rounded-2xl p-6 flex flex-col gap-5">
                {/* Número + stat */}
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-black text-white/20 tracking-widest">{f.num}</span>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary num-badge leading-none">{f.stat}</p>
                    <p className="text-[10px] text-muted-foreground">{f.statLabel}</p>
                  </div>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 space-y-2">
                  <h3 className="font-black text-base leading-tight">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>

                {/* Badge */}
                <div>
                  <span className={cn(
                    'text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider',
                    f.badge === 'Pro'
                      ? 'bg-primary text-black'
                      : f.badge === 'Afiliado'
                      ? 'bg-white/10 text-white/70 border border-white/10'
                      : 'bg-white/8 text-white/50 border border-white/8'
                  )}>
                    {f.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="mt-12 flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/15 rounded-2xl px-5 py-4 max-w-2xl mx-auto">
            <svg className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2L2 17h16L10 2z"/><path d="M10 8v4M10 14v.5"/>
            </svg>
            <p className="text-xs text-white/40 leading-relaxed">
              As análises geradas pelo BetCopiloto são baseadas em dados estatísticos e têm caráter exclusivamente informativo. <strong className="text-white/60">Não garantimos acerto e não nos responsabilizamos por perdas financeiras.</strong> Aposte com responsabilidade. +18.
            </p>
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="planos" className="py-28 px-5 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-4">Planos</p>
            <h2 className="text-4xl sm:text-5xl font-black leading-tight">Comece grátis.<br />Escale quando quiser.</h2>
            <p className="text-muted-foreground mt-4">Sem fidelidade. Cancele quando quiser.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5 items-stretch">
            {/* Free */}
            <div className="bg-[oklch(0.11_0_0)] border border-white/8 rounded-2xl p-8 flex flex-col gap-6">
              <div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Free</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black">R$ 0</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Para sempre</p>
              </div>
              <ul className="space-y-3 flex-1">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="w-4 h-4 rounded-full border border-white/15 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register"
                className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-center font-bold h-12 border-white/12 hover:border-primary/40')}>
                Começar grátis
              </Link>
            </div>

            {/* Pro */}
            <div className="relative bg-primary/8 border border-primary/35 rounded-2xl p-8 flex flex-col gap-6 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/12 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute top-0 left-0 w-20 h-20 bg-primary/8 rounded-full blur-2xl pointer-events-none" />

              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black text-primary uppercase tracking-widest">Pro</p>
                  <span className="text-[10px] font-black bg-primary text-black px-3 py-1 rounded-full">MAIS POPULAR</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-primary num-badge">R$ 49</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Cancele quando quiser</p>
              </div>

              <ul className="relative space-y-3 flex-1">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <div className="w-4 h-4 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="oklch(0.63 0.19 145)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="relative space-y-2">
                <Link href="/api/checkout/criar"
                  className={cn(buttonVariants(), 'w-full justify-center font-black h-12 text-sm gap-2')}>
                  Assinar Pro — R$ 49/mês
                </Link>
                <p className="text-[10px] text-muted-foreground text-center">Pagamento via Asaas · Pix ou cartão</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section className="py-28 px-5 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-4">Depoimentos</p>
            <h2 className="text-4xl sm:text-5xl font-black">O que dizem<br />os apostadores</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="card-hover bg-[oklch(0.11_0_0)] border border-white/6 rounded-2xl p-6 flex flex-col gap-5">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="oklch(0.63 0.19 145)">
                      <path d="M6 1L7.5 4.5H11L8.2 6.8L9.2 10.5L6 8.5L2.8 10.5L3.8 6.8L1 4.5H4.5L6 1Z"/>
                    </svg>
                  ))}
                  <span className="ml-auto text-xs font-black text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                    {t.roi}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-primary">{t.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-28 px-5 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="relative rounded-3xl border border-primary/25 bg-primary/6 p-14 text-center overflow-hidden">
            <div className="absolute inset-0 dot-grid opacity-30" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-primary/12 rounded-full blur-3xl" />
            <div className="relative space-y-6">
              <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">Comece hoje</p>
              <h2 className="text-4xl sm:text-5xl font-black leading-tight">
                Pronto para apostar<br />
                <span className="text-primary">com inteligência?</span>
              </h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Junte-se a apostadores que usam dados reais para tomar decisões melhores.
              </p>
              <Link href="/register"
                className={cn(buttonVariants({ size: 'lg' }), 'pulse h-14 px-12 text-base font-black gap-2')}>
                Criar conta grátis
                <ChevronRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-muted-foreground">Sem cartão · Grátis para sempre no plano Free</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/6 py-12 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="relative w-7 h-7">
                  <div className="absolute inset-0 rounded-lg bg-primary" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                      <path d="M3 13L7 9L10 12L15 5" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="15" cy="5" r="1.5" fill="black"/>
                    </svg>
                  </div>
                </div>
                <span className="font-black text-sm">BetCopiloto</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">
                Aposte com inteligência. Dados reais para decisões melhores.
              </p>
            </div>

            <div className="flex gap-10 text-sm text-muted-foreground">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-foreground uppercase tracking-wider">App</p>
                <div className="space-y-2">
                  <Link href="/dashboard" className="block hover:text-foreground transition-colors">Dashboard</Link>
                  <Link href="/avaliar" className="block hover:text-foreground transition-colors">Avaliar bilhete</Link>
                  <Link href="/planos" className="block hover:text-foreground transition-colors">Planos</Link>
                  <Link href="/afiliado" className="block hover:text-foreground transition-colors">Afiliados</Link>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-foreground uppercase tracking-wider">Conta</p>
                <div className="space-y-2">
                  <Link href="/login" className="block hover:text-foreground transition-colors">Entrar</Link>
                  <Link href="/register" className="block hover:text-foreground transition-colors">Cadastrar</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/5 space-y-3">
            <p className="text-[10px] text-white/25 leading-relaxed text-center max-w-2xl mx-auto">
              As análises geradas pelo BetCopiloto são baseadas em dados estatísticos e têm caráter exclusivamente informativo. Não garantimos acerto e não nos responsabilizamos por perdas financeiras. O uso das informações é de total responsabilidade do usuário.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>© {new Date().getFullYear()} BetCopiloto. Todos os direitos reservados.</p>
              <p>Aposte com responsabilidade. +18.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
