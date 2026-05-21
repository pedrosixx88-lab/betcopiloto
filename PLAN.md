# BetCopiloto — Plano de Build

## Visão Geral

SaaS B2C para apostadores esportivos brasileiros. O usuário tira print do bilhete, a IA lê e registra tudo automaticamente. Com o tempo, a IA aprende os padrões do usuário e monta bilhetes personalizados todo dia.

---

## Milestones

### ✅ Milestone 1 — Foundation + Auth
**Status:** Pendente

**Objetivo:** Projeto scaffoldado, autenticação funcionando, onboarding completo.

**Entregas:**
- [ ] Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui configurados
- [ ] Dark theme configurado como padrão
- [ ] Supabase conectado (auth + schema do banco)
- [ ] Páginas: `/` (landing placeholder), `/login`, `/register`, `/onboarding`, `/dashboard` (placeholder)
- [ ] Login e cadastro com email/senha via Supabase Auth
- [ ] E-mail de verificação e reset de senha
- [ ] Onboarding guiado: banca inicial, ligas favoritas, casa de aposta principal
- [ ] Proteção de rotas (middleware)

**Teste:** Usuário consegue se cadastrar, verificar e-mail, completar onboarding e chegar no dashboard.

---

### Milestone 2 — Registro de Apostas (Core Loop)
**Status:** Pendente

**Objetivo:** Usuário consegue registrar apostas via screenshot ou manualmente.

**Entregas:**
- [ ] Upload de screenshot para Supabase Storage
- [ ] Integração com Claude Vision API — extrai times, mercado, odd, valor e data
- [ ] Formulário de confirmação pré-preenchido pela IA
- [ ] Entrada manual como fallback
- [ ] Armazenamento das apostas no Supabase
- [ ] Histórico completo de apostas (lista com filtros)

**Teste:** Usuário faz upload de um print de bilhete da Betano/Bet365 e a aposta é registrada corretamente.

---

### Milestone 3 — Resultados Automáticos + Dashboard
**Status:** Pendente

**Objetivo:** Dashboard com dados reais. Resultados atualizados sem ação do usuário.

**Entregas:**
- [ ] Integração com API-Football para buscar resultados
- [ ] Job automático (cron no Vercel) que atualiza win/loss quando jogo termina
- [ ] Dashboard: ROI total, win rate, lucro/prejuízo do mês
- [ ] Gráfico de evolução da banca ao longo do tempo
- [ ] Breakdown por liga e por tipo de aposta
- [ ] Análise de padrões pessoais gerada pela IA

**Teste:** Aposta registrada no M2 tem resultado atualizado automaticamente após o jogo.

---

### Milestone 4 — Análise de Jogos + Montador de Bilhete
**Status:** Pendente

**Objetivo:** Usuário recebe bilhete personalizado diário com justificativas.

**Entregas:**
- [ ] Lista de jogos do dia via API-Football
- [ ] Análise individual por jogo com Claude + web search (forma, H2H, desfalques, contexto)
- [ ] Cache de análise por jogo — gerado uma vez, servido para todos
- [ ] Chat conversacional sobre qualquer jogo
- [ ] Montador de bilhete: usuário informa valor, IA cruza histórico + análise + gestão de banca
- [ ] Alerta quando IA detecta padrão negativo do usuário no bilhete sugerido

**Teste:** Usuário informa R$50 e recebe bilhete com 3 seleções explicadas, stake sugerido e alertas de padrão.

---

### Milestone 5 — Briefing Diário + PWA
**Status:** Pendente

**Objetivo:** Usuário recebe push notification toda manhã com o briefing do dia.

**Entregas:**
- [ ] PWA configurado (manifest, service worker, ícones)
- [ ] Web Push API para notificações sem dependência externa
- [ ] Briefing gerado automaticamente às 9h BRT (cron)
- [ ] Usuário pode solicitar briefing via chat a qualquer momento
- [ ] Configuração de horário e ligas favoritas

**Teste:** Usuário instala o PWA no celular e recebe notificação às 9h com o briefing.

---

### Milestone 6 — Monetização + Afiliados
**Status:** Pendente

**Objetivo:** Infraestrutura de receita funcionando. Afiliados conseguem ganhar.

**Entregas:**
- [ ] Integração com Mercado Pago — assinatura recorrente
- [ ] Webhook para ativar/cancelar plano Pro automaticamente
- [ ] Plano Free vs Pro com feature gates
- [ ] Geração de link e código único por afiliado
- [ ] Dashboard do afiliado (conversões, usuários ativos, ganhos)
- [ ] Lógica de pagamento via Pix todo dia 10

**Teste:** Usuário assina o Pro, webhook ativa o plano, acesso a features premium liberado.

---

### Milestone 7 — Landing Page + Polish
**Status:** Pendente

**Objetivo:** Produto público pronto para aquisição de usuários.

**Entregas:**
- [ ] Landing page em `/` (hero, como funciona, pricing, CTA, depoimentos)
- [ ] Fluxos de e-mail via Resend (boas-vindas, briefing, recibo de pagamento)
- [ ] SEO básico (meta tags, OG, sitemap)
- [ ] Audit de performance (Core Web Vitals)
- [ ] Revisão geral de UX mobile

**Teste:** Landing page carrega em < 2s no mobile, CTAs levam ao cadastro corretamente.

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) + React + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui |
| Banco / Auth / Storage | Supabase |
| Hospedagem | Vercel |
| IA | Claude API (claude-sonnet) — vision + web search |
| Dados de futebol | API-Football (api-sports.io) |
| Pagamentos | Mercado Pago |
| E-mail | Resend |
| Mobile | PWA (sem app nativo) |

---

## Regras de Desenvolvimento

1. Sempre mobile-first — apostadores usam o app no celular
2. Dark mode como padrão absoluto — sem toggle claro/escuro na v1
3. Zero digitação no fluxo principal — screenshot → confirmação → pronto
4. Cache de análises de jogos — nunca chamar Claude duas vezes pro mesmo jogo
5. Supabase RLS em todas as tabelas — cada usuário vê só os próprios dados
6. Cada milestone é testado antes de avançar pro próximo
