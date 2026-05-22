import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  TrendingUp, Camera, Brain, Ticket, ChevronRight,
  CheckCircle2, Star, Zap, BarChart3, Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'

const HOW_IT_WORKS = [
  {
    icon: Camera,
    title: 'Tire um print',
    desc: 'Fotografe seu bilhete na Betano, Bet365 ou qualquer casa. A IA lê tudo automaticamente.',
  },
  {
    icon: BarChart3,
    title: 'Acompanhe sua performance',
    desc: 'Dashboard com ROI, win rate por mercado e evolução da banca em tempo real.',
  },
  {
    icon: Brain,
    title: 'Receba análises com IA',
    desc: 'Cada jogo analisado com H2H, forma recente e odds reais da Bet365.',
  },
  {
    icon: Ticket,
    title: 'Monte bilhetes inteligentes',
    desc: 'A IA cruza seu histórico com as análises e monta o bilhete otimizado para você.',
  },
]

const FEATURES_FREE = [
  'Registro de apostas via print',
  'Dashboard com ROI e win rate',
  'Análise de jogos com IA',
  'Briefing diário às 9h',
  'Até 10 apostas por mês',
]

const FEATURES_PRO = [
  'Tudo do plano gratuito',
  'Apostas ilimitadas',
  'Montador de bilhete personalizado',
  'Chat com IA por jogo',
  'Alertas de padrões negativos',
  'Odds reais da Bet365 em tempo real',
  'Suporte prioritário',
]

const TESTIMONIALS = [
  {
    name: 'Rafael M.',
    role: 'Apostador há 3 anos',
    text: 'Finalmente consigo enxergar onde estou errando. O dashboard de win rate por mercado mudou minha forma de apostar.',
    stars: 5,
  },
  {
    name: 'Lucas F.',
    role: 'Apostador esportivo',
    text: 'O briefing das 9h virou rotina. Chego no trabalho já sabendo quais jogos vale analisar à noite.',
    stars: 5,
  },
  {
    name: 'André P.',
    role: 'Apostador de fim de semana',
    text: 'Nunca mais precisei digitar nada. Tiro o print e em segundos a aposta está registrada.',
    stars: 5,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-bold text-base tracking-tight">BetCopiloto</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Entrar
            </Link>
            <Link href="/register" className={buttonVariants({ size: 'sm' })}>
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-20 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-brand-muted border border-primary/20 text-primary text-xs font-medium px-3 py-1.5 rounded-full">
            <Zap className="h-3 w-3" />
            IA que aprende com você
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
            Seu segundo cérebro<br />
            <span className="text-primary">nas apostas esportivas</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-lg mx-auto">
            Registre apostas com um print, acompanhe sua performance e receba bilhetes personalizados todos os dias.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href="/register" className={buttonVariants({ size: 'lg', className: 'font-semibold text-base h-12 px-8' })}>
              Começar grátis
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
            <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-12 px-8' })}>
              Já tenho conta
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">Sem cartão de crédito · Grátis para começar</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 border-y border-border">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-4 text-center">
          {[
            { value: '2 seg', label: 'para registrar um bilhete' },
            { value: '5+', label: 'mercados analisados por jogo' },
            { value: '9h', label: 'briefing diário com IA' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Como funciona</h2>
            <p className="text-muted-foreground">Simples como tirar uma foto</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-muted flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">0{i + 1}</span>
                </div>
                <h3 className="font-semibold text-base">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features highlight */}
      <section className="py-20 px-4 bg-card border-y border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Tudo que você precisa</h2>
            <p className="text-muted-foreground">De apostador para apostador</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: Camera,
                title: 'Print → Aposta',
                desc: 'Claude Vision lê seu bilhete e extrai times, mercado, odd e valor sem você digitar nada.',
              },
              {
                icon: BarChart3,
                title: 'Dashboard real',
                desc: 'ROI, win rate por mercado, evolução da banca. Dados que casas de aposta escondem de você.',
              },
              {
                icon: Shield,
                title: 'Gestão de banca',
                desc: 'A IA detecta padrões negativos e avisa antes de você repetir o mesmo erro.',
              },
            ].map((f) => (
              <div key={f.title} className="space-y-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-brand-muted flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4" id="pricing">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Planos simples</h2>
            <p className="text-muted-foreground">Comece grátis, escale quando quiser</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">

            {/* Free */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gratuito</p>
                <p className="text-3xl font-bold mt-1">R$ 0</p>
                <p className="text-xs text-muted-foreground mt-1">para sempre</p>
              </div>
              <ul className="space-y-2.5">
                {FEATURES_FREE.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
                Começar grátis
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-brand-muted border border-primary/30 rounded-2xl p-6 space-y-6 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">POPULAR</span>
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Pro</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <p className="text-3xl font-bold">R$ 29</p>
                  <p className="text-sm text-muted-foreground">/mês</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">cancele quando quiser</p>
              </div>
              <ul className="space-y-2.5">
                {FEATURES_PRO.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={buttonVariants({ className: 'w-full font-semibold' })}>
                Assinar Pro
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="py-20 px-4 bg-card border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">O que dizem os apostadores</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-background border border-border rounded-2xl p-5 space-y-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{t.text}"</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-lg mx-auto space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Pronto para apostar com inteligência?</h2>
          <p className="text-muted-foreground">Junte-se a apostadores que já usam dados para tomar decisões melhores.</p>
          <Link href="/register" className={cn(buttonVariants({ size: 'lg', className: 'font-semibold text-base h-12 px-10' }))}>
            Começar grátis agora
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">BetCopiloto</span>
          </div>
          <p>© {new Date().getFullYear()} BetCopiloto. Aposte com responsabilidade.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground transition-colors">Entrar</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Cadastrar</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
