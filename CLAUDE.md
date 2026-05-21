@AGENTS.md

# CLAUDE.md — BetCopiloto

## Idioma
Sempre responder em **português brasileiro**. Comentários de código, mensagens de erro voltadas ao usuário e toda comunicação em PT-BR.

## O que é este projeto
BetCopiloto é um SaaS B2C para apostadores esportivos brasileiros. O fluxo central é: usuário faz upload de screenshot do bilhete → Claude Vision lê e extrai os dados → resultados atualizados automaticamente via API-Football → IA aprende padrões e monta bilhetes personalizados.

Consulte o [PLAN.md](./PLAN.md) para o roadmap completo de milestones.

## ⚠️ Regra obrigatória para cada novo Milestone

### Antes de começar
1. Leia o `CLAUDE.md` e o `PLAN.md`
2. Crie uma branch para a feature: `git checkout -b milestone-X-nome`
3. Descreva o que vai implementar (lista de entregas) e aguarde confirmação

### Durante o desenvolvimento
- Implemente milestone por milestone, nunca misture features de milestones diferentes
- A cada entrega significativa, revise o que foi criado antes de continuar
- **Teste visual obrigatório:** rodar o app e mostrar o resultado visual para acompanharmos juntos — nunca declarar "funcionando" sem evidência visual

### Após validação etapa por etapa
1. Revise tudo que foi criado no milestone
2. Faça o commit: `git commit -m "feat: milestone X — descrição"`
3. Abra um PR para main
4. Faça o merge
5. Delete a branch

**Nunca pular nenhuma dessas etapas.**

---

## Stack
- **Framework:** Next.js 16 com App Router (nunca Pages Router)
- **Linguagem:** TypeScript (strict)
- **Estilo:** Tailwind CSS v4 + shadcn/ui (usa @base-ui/react — sem asChild, usar buttonVariants + Link)
- **Banco / Auth / Storage:** Supabase
- **IA:** Claude API `claude-sonnet-4-6` — vision para screenshots, web search para análise de jogos
- **Dados de futebol:** API-Football (api-sports.io)
- **Pagamentos:** Mercado Pago (assinatura recorrente)
- **E-mail:** Resend
- **Hospedagem:** Vercel (serverless)
- **Mobile:** PWA — sem app nativo

## Estrutura de pastas
```
src/
  app/
    (auth)/       # login, register — rotas públicas
    (app)/        # dashboard, onboarding — rotas protegidas
    auth/         # callback de autenticação
    api/          # API routes server-side
  components/
    ui/           # componentes shadcn/ui
    layout/       # bottom-nav, header
  lib/
    supabase/     # client.ts, server.ts, admin.ts
  types/          # database.ts e outros types
supabase/
  schema.sql      # schema do banco — rodar no SQL Editor
```

## Regras de desenvolvimento

### Geral
- Mobile-first sempre — apostadores usam o app no celular
- Dark mode como padrão absoluto — classe `dark` no `<html>`, não implementar toggle
- Zero comentários desnecessários — só comentar o "porquê" quando não óbvio
- Não adicionar features além do milestone atual

### shadcn/ui (Tailwind v4)
- O Button usa `@base-ui/react` — **não tem `asChild`**
- Para links com estilo de botão: `<Link className={buttonVariants({ variant, size })}>texto</Link>`

### Segurança
- Supabase RLS ativo em todas as tabelas
- Nunca expor chaves de API no cliente — sempre server-side
- Validar inputs em todas as API routes

### Performance
- Cache de análises de jogos no Supabase — gerado uma vez por jogo, servido para todos
- Nunca chamar Claude duas vezes para o mesmo jogo no mesmo dia
- Screenshots: Supabase Storage, nunca base64 no banco

### Padrões Next.js
- Server Components por padrão — `"use client"` só quando necessário
- Middleware em `src/middleware.ts`

## Variáveis de ambiente
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
API_FOOTBALL_KEY=
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

## Design Language
- **Cor primária:** verde (`oklch(0.63 0.19 145)`) — associação com lucro/green
- **Background:** `oklch(0.09 0 0)` — dark mode absoluto
- **Tipografia:** Geist Sans
- **Referências:** Robinhood (dashboard), Linear (tipografia dark), Bet365 (hierarquia)
- **Tom:** Premium, direto ao ponto, sem poluição visual
