import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  TrendingUp, Camera, Brain, Ticket, ChevronRight,
  CheckCircle2, Star, Zap, BarChart3, Shield, Bell, MessageSquare, Target
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TESTIMONIALS = [
  {
    name: 'Rafael Mendonça',
    role: 'Apostador há 3 anos · São Paulo',
    text: 'Em 2 meses descobri que tinha 68% de win rate no mercado de over/under e nem sabia. Agora foco só nisso.',
    roi: '+31% ROI',
    stars: 5,
  },
  {
    name: 'Lucas Ferreira',
    role: 'Apostador esportivo · Belo Horizonte',
    text: 'O briefing das 9h virou ritual. Chego no trabalho já sabendo exatamente quais jogos vale analisar à noite.',
    roi: '+18% ROI',
    stars: 5,
  },
  {
    name: 'André Pacheco',
    role: 'Apostador de fim de semana · Rio de Janeiro',
    text: 'Nunca mais digitei nada manualmente. Tiro o print e em 3 segundos a aposta está registrada com tudo certinho.',
    roi: '-40% erros',
    stars: 5,
  },
]

const FEATURES = [
  {
    icon: Camera,
    title: 'Print → Aposta em 3s',
    desc: 'Claude Vision lê seu bilhete e extrai times, mercado, odd e valor. Zero digitação.',
    badge: 'IA Vision',
  },
  {
    icon: BarChart3,
    title: 'Dashboard real',
    desc: 'ROI, win rate por mercado e evolução da banca. Dados que as casas escondem de você.',
    badge: 'Tempo real',
  },
  {
    icon: Brain,
    title: 'Análise profunda por jogo',
    desc: 'H2H, forma recente, desfalques e odds analisados pela IA antes de você apostar.',
    badge: 'Claude AI',
  },
  {
    icon: MessageSquare,
    title: 'Chat IA sobre qualquer jogo',
    desc: 'Tire dúvidas, peça análises específicas ou debata odds com a IA em tempo real.',
    badge: 'Pro',
  },
  {
    icon: Ticket,
    title: 'Montador de bilhete',
    desc: 'A IA cruza seu histórico com as análises e monta o bilhete otimizado para você.',
    badge: 'Pro',
  },
  {
    icon: Bell,
    title: 'Briefing diário às 9h',
    desc: 'Push notification com os melhores jogos do dia selecionados pela IA toda manhã.',
    badge: 'Pro',
  },
]

const FREE_FEATURES = [
  'Registro ilimitado de apostas',
  'Dashboard com métricas e ROI',
  'Lista de jogos do dia',
  'Briefing diário (sem push)',
]

const PRO_FEATURES = [
  'Tudo do plano Free',
  'Análise completa de cada jogo com IA',
  'Chat IA sobre qualquer jogo',
  'Montador de bilhete inteligente',
  'Push notification do briefing',
  'Suporte prioritário',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 oklch(0.63 0.19 145 / 0.3); }
          50% { box-shadow: 0 0 0 8px oklch(0.63 0.19 145 / 0); }
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-fade-up { animation: fadeUp 0.7s ease forwards; }
        .animate-fade-up-delay-1 { animation: fadeUp 0.7s 0.1s ease both; }
        .animate-fade-up-delay-2 { animation: fadeUp 0.7s 0.2s ease both; }
        .animate-fade-up-delay-3 { animation: fadeUp 0.7s 0.3s ease both; }
        .animate-fade-in { animation: fadeIn 1s ease forwards; }
        .pulse-glow { animation: pulse-glow 2s infinite; }
        .ticker-wrap { overflow: hidden; }
        .ticker { display: flex; animation: ticker 30s linear infinite; width: max-content; }
        .grid-bg {
          background-image: linear-gradient(oklch(0.63 0.19 145 / 0.04) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.63 0.19 145 / 0.04) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .glow-line {
          background: linear-gradient(90deg, transparent, oklch(0.63 0.19 145 / 0.6), transparent);
          height: 1px;
        }
      `}</style>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-black" />
            </div>
            <span className="font-bold text-base tracking-tight">BetCopiloto</span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-muted-foreground' })}>
              Entrar
            </Link>
            <Link href="/register" className={cn(buttonVariants({ size: 'sm' }), 'pulse-glow font-semibold')}>
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 grid-bg">
        {/* Radial glow */}
        <div className="absolute inset-0 flex items-start justify-center pointer-events-none overflow-hidden">
          <div className="w-[600px] h-[400px] rounded-full bg-primary/8 blur-[100px] mt-10" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <div className="animate-fade-up inline-flex items-center gap-2 border border-primary/25 bg-primary/8 text-primary text-xs font-semibold px-4 py-1.5 rounded-full">
            <Zap className="h-3 w-3" />
            IA generativa aplicada a apostas esportivas
          </div>

          <h1 className="animate-fade-up-delay-1 text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            Seu copiloto<br />
            <span className="text-primary">nas apostas</span>
          </h1>

          <p className="animate-fade-up-delay-2 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Registre apostas com um print, acompanhe seu ROI real e receba bilhetes personalizados com IA todos os dias.
          </p>

          <div className="animate-fade-up-delay-3 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className={cn(buttonVariants({ size: 'lg' }), 'h-13 px-8 text-base font-bold')}>
              Começar grátis
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
            <Link href="#planos" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-13 px-8 text-base border-white/10 hover:border-white/20')}>
              Ver planos
            </Link>
          </div>
          <p className="animate-fade-up-delay-3 text-xs text-muted-foreground">Grátis para sempre · Sem cartão de crédito</p>

          {/* Dashboard mockup */}
          <div className="animate-fade-in mt-12 relative mx-auto max-w-3xl">
            <div className="absolute -inset-1 bg-gradient-to-b from-primary/20 to-transparent rounded-3xl blur-xl" />
            <div className="relative bg-card border border-white/8 rounded-2xl overflow-hidden shadow-2xl">
              {/* Mockup header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="text-[11px] text-muted-foreground bg-white/5 px-3 py-0.5 rounded-full">betcopiloto-app-seven.vercel.app/dashboard</div>
                </div>
              </div>
              {/* Mockup content */}
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold">Olá, Rafael 👋</p>
                    <p className="text-xs text-muted-foreground">Sua performance</p>
                  </div>
                  <div className="text-xs bg-primary/15 text-primary font-semibold px-3 py-1.5 rounded-lg border border-primary/20">
                    + Registrar aposta
                  </div>
                </div>
                {/* Metric cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Banca atual', value: 'R$ 2.840', color: 'text-foreground' },
                    { label: 'Lucro/Prejuízo', value: '+R$ 840', color: 'text-primary' },
                    { label: 'Win Rate', value: '64.2%', color: 'text-primary' },
                    { label: 'ROI', value: '+31.4%', color: 'text-primary' },
                  ].map(m => (
                    <div key={m.label} className="bg-background/60 border border-white/5 rounded-xl p-3 space-y-1">
                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                      <p className={cn('text-lg font-bold', m.color)}>{m.value}</p>
                    </div>
                  ))}
                </div>
                {/* Briefing preview */}
                <div className="bg-primary/8 border border-primary/15 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold text-primary">Briefing do dia — Sábado, 24 maio</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Crystal Palace vs Arsenal</strong> — duelo decisivo na Premier League com o Arsenal pressionado a vencer...
                    <strong className="text-foreground"> Corinthians vs Atlético-MG</strong> — clássico de peso no Brasileirão Série A...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker stats */}
      <div className="border-y border-white/5 py-4 ticker-wrap">
        <div className="ticker">
          {[...Array(2)].map((_, rep) => (
            <div key={rep} className="flex items-center gap-12 px-6">
              {[
                { v: '3 segundos', l: 'para registrar um bilhete' },
                { v: '+31% ROI', l: 'média dos usuários Pro' },
                { v: '9h da manhã', l: 'briefing diário com IA' },
                { v: '5+ mercados', l: 'analisados por jogo' },
                { v: '100%', l: 'automático via print' },
                { v: '30%', l: 'comissão de afiliados' },
              ].map(s => (
                <div key={s.l + rep} className="flex items-center gap-3 shrink-0">
                  <span className="text-primary font-bold text-lg">{s.v}</span>
                  <span className="text-muted-foreground text-sm">{s.l}</span>
                  <span className="text-white/10 text-xl ml-6">·</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Como funciona */}
      <section id="como-funciona" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Como funciona</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Simples como tirar uma foto</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Três passos para transformar seus hábitos de aposta</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 relative">
            {/* Connecting line desktop */}
            <div className="hidden sm:block absolute top-10 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] glow-line" />
            {[
              {
                n: '01',
                icon: Camera,
                title: 'Tire um print',
                desc: 'Fotografe seu bilhete na Betano, Bet365 ou qualquer casa. Nossa IA lê tudo automaticamente.',
              },
              {
                n: '02',
                icon: Zap,
                title: 'IA processa tudo',
                desc: 'Times, mercado, odd, valor apostado e data — extraídos em segundos sem você digitar nada.',
              },
              {
                n: '03',
                icon: Target,
                title: 'Acompanhe e evolua',
                desc: 'Dashboard com ROI real, win rate por mercado, análises IA e bilhetes personalizados todo dia.',
              },
            ].map((step, i) => (
              <div key={i} className="relative flex flex-col items-center text-center gap-4 p-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <step.icon className="h-7 w-7 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-[10px] font-black text-black">{i + 1}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-primary/60 tracking-widest">{step.n}</p>
                  <h3 className="font-bold text-lg">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="py-24 px-4 grid-bg border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Tudo que você precisa</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Construído por apostadores, para apostadores</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="group bg-card/50 border border-white/5 hover:border-primary/20 rounded-2xl p-5 space-y-3 transition-all duration-300 hover:bg-card">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    f.badge === 'Pro' ? 'bg-primary/15 text-primary border border-primary/20' : 'bg-white/5 text-muted-foreground border border-white/10'
                  )}>
                    {f.badge}
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Planos</p>
            <h2 className="text-3xl sm:text-4xl font-bold">Comece grátis, escale quando quiser</h2>
            <p className="text-muted-foreground">Sem fidelidade. Cancele quando quiser.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Free */}
            <div className="bg-card border border-white/8 rounded-2xl p-7 space-y-6 flex flex-col">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold text-muted-foreground">Free</p>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <p className="text-4xl font-bold">R$ 0</p>
                  <p className="text-sm text-muted-foreground">/mês</p>
                </div>
                <p className="text-xs text-muted-foreground">Para sempre</p>
              </div>
              <ul className="space-y-3 flex-1">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-center border-white/10 hover:border-white/20')}>
                Começar grátis
              </Link>
            </div>

            {/* Pro */}
            <div className="relative bg-primary/8 border border-primary/30 rounded-2xl p-7 space-y-6 flex flex-col overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-primary">Pro</p>
                  </div>
                  <span className="text-[10px] font-black bg-primary text-black px-2.5 py-0.5 rounded-full">MAIS POPULAR</span>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <p className="text-4xl font-bold text-primary">R$ 49</p>
                  <p className="text-sm text-muted-foreground">/mês</p>
                </div>
                <p className="text-xs text-muted-foreground">Cancele quando quiser</p>
              </div>
              <ul className="space-y-3 flex-1">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/api/checkout/criar" className={cn(buttonVariants(), 'w-full justify-center font-bold')}>
                <TrendingUp className="h-4 w-4 mr-1.5" /> Assinar Pro — R$ 49/mês
              </Link>
              <p className="text-[10px] text-muted-foreground text-center -mt-3">Pagamento via Mercado Pago · Pix ou cartão</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Depoimentos</p>
            <h2 className="text-3xl sm:text-4xl font-bold">O que dizem os apostadores</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-card border border-white/5 rounded-2xl p-6 space-y-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/15">
                    {t.roi}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-1 border-t border-white/5">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{t.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="relative bg-primary/8 border border-primary/20 rounded-3xl p-12 space-y-6 overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-40" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/15 rounded-full blur-3xl" />
            <div className="relative space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">Comece hoje</p>
              <h2 className="text-3xl sm:text-4xl font-bold">Pronto para apostar<br />com inteligência?</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Junte-se a apostadores que já usam dados reais para tomar decisões melhores.
              </p>
            </div>
            <div className="relative flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register" className={cn(buttonVariants({ size: 'lg' }), 'h-13 px-10 text-base font-bold pulse-glow')}>
                Criar conta grátis
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            <p className="relative text-xs text-muted-foreground">Sem cartão · Grátis para sempre no plano Free</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-black" />
                </div>
                <span className="font-bold">BetCopiloto</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs">
                Aposte com inteligência. Use dados para tomar decisões melhores.
              </p>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs uppercase tracking-wider">App</p>
                <div className="space-y-1.5">
                  <Link href="/dashboard" className="block hover:text-foreground transition-colors">Dashboard</Link>
                  <Link href="/planos" className="block hover:text-foreground transition-colors">Planos</Link>
                  <Link href="/afiliado" className="block hover:text-foreground transition-colors">Afiliados</Link>
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-foreground text-xs uppercase tracking-wider">Conta</p>
                <div className="space-y-1.5">
                  <Link href="/login" className="block hover:text-foreground transition-colors">Entrar</Link>
                  <Link href="/register" className="block hover:text-foreground transition-colors">Cadastrar</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} BetCopiloto. Todos os direitos reservados.</p>
            <p>Aposte com responsabilidade. +18.</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
