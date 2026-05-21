---
name: integration-specialist
description: "Use when implementando qualquer integração externa no BetCopiloto: Claude API (vision + web search), API-Football, Mercado Pago (assinaturas recorrentes + webhooks), Resend (e-mails), Supabase Storage (upload de screenshots), ou qualquer chamada a API de terceiros."
metadata:
  author: betcopiloto
  version: "1.0.0"
---

# Integration Specialist — BetCopiloto

Especialista nas integrações externas do BetCopiloto. Cada integração tem padrões específicos a seguir.

## Integrações do Projeto

### 1. Claude API — Vision + Web Search

**Modelo:** `claude-sonnet-4-6`

**Screenshot de bilhete (Vision):**
- Recebe a imagem do Supabase Storage como URL assinada
- Prompt estruturado para extrair: times, mercado, odd, valor apostado, data, casa de apostas
- Retorna JSON validado com `zod`
- Nunca retornar dados sem validação de schema

**Análise de jogos (Web Search):**
- Usa `web_search` tool para buscar dados em tempo real
- Busca: forma recente dos times, H2H, desfalques confirmados, contexto da partida
- Resultado SEMPRE cacheado no Supabase antes de retornar ao usuário
- Cache key: `{game_id}_{date}` — nunca chamar Claude duas vezes para o mesmo jogo no mesmo dia

**Padrão de cache obrigatório:**
```typescript
// 1. Verificar cache
const cached = await supabase.from('game_analyses').select().eq('game_id', gameId).eq('date', today).single()
if (cached.data) return cached.data

// 2. Gerar com Claude
const analysis = await claude.messages.create(...)

// 3. Salvar cache
await supabase.from('game_analyses').insert({ game_id: gameId, date: today, analysis })
```

### 2. API-Football (api-sports.io)

**Base URL:** `https://v3.football.api-sports.io`
**Header:** `x-apisports-key: ${API_FOOTBALL_KEY}`

**Endpoints principais:**
- `GET /fixtures?date={YYYY-MM-DD}&league={id}` — jogos do dia
- `GET /fixtures?id={fixture_id}` — detalhes + resultado
- `GET /fixtures/headtohead?h2h={team1_id}-{team2_id}` — H2H
- `GET /standings?league={id}&season={year}` — tabela

**Regras:**
- Rate limit: 100 requests/dia no plano básico — cachear TUDO no Supabase
- Cache de jogos do dia: válido por 1 hora
- Cache de resultados finalizados: permanente (status: FT, AET, PEN)
- Nunca chamar em client-side — sempre via API route server-side

**Status de jogo relevantes:** `NS` (não iniciado), `1H`, `HT`, `2H` (em andamento), `FT` (finalizado), `PST` (adiado), `CANC` (cancelado)

### 3. Mercado Pago — Assinaturas Recorrentes

**SDK:** `mercadopago` npm package
**Docs:** https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscriptions-associated-plan

**Fluxo de assinatura:**
1. Criar plano no MP Dashboard (R$39 early adopter / R$49 oficial)
2. `POST /preapproval` para criar assinatura do usuário
3. Redirecionar para `init_point` do MP
4. Webhook recebe eventos: `authorized`, `cancelled`, `paused`
5. Webhook atualiza `users.plan` no Supabase

**Webhook — verificação obrigatória:**
```typescript
const isValid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
)
if (!isValid) return Response.json({ error: 'Invalid signature' }, { status: 401 })
```

**Eventos do webhook:**
- `payment` com `status: approved` → ativar Pro
- `preapproval` com `status: cancelled` → cancelar Pro
- `preapproval` com `status: paused` → manter acesso até fim do período

### 4. Resend — E-mails Transacionais

**SDK:** `resend` npm package
**From:** `BetCopiloto <noreply@betcopiloto.com.br>`

**Templates necessários:**
- Boas-vindas após cadastro
- Verificação de e-mail (via Supabase Auth)
- Reset de senha (via Supabase Auth)
- Briefing diário (backup do push)
- Recibo de pagamento

**Padrão:**
```typescript
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'BetCopiloto <noreply@betcopiloto.com.br>',
  to: user.email,
  subject: '...',
  react: EmailTemplate({ ... })
})
```

### 5. Supabase Storage — Screenshots

**Bucket:** `bet-screenshots` (privado — não público)
**Path:** `{user_id}/{timestamp}_{random}.jpg`

**Fluxo:**
1. Upload do client com `supabase.storage.from('bet-screenshots').upload(path, file)`
2. Gerar URL assinada (1 hora) para passar ao Claude Vision
3. Nunca armazenar base64 no banco — sempre referência ao Storage

```typescript
const { data: signedUrl } = await supabase.storage
  .from('bet-screenshots')
  .createSignedUrl(path, 3600)
```

## Regras Gerais de Integração

1. **Todas as chamadas externas ficam em `src/lib/`** — nunca inline nos componentes
2. **Variáveis de ambiente server-side** — nunca expor keys no cliente (`NEXT_PUBLIC_` só para Supabase URL e anon key)
3. **Tratar erros explicitamente** — toda integração pode falhar; ter fallback visual
4. **Logs estruturados** — logar request/response em desenvolvimento, apenas erros em produção
5. **Timeouts** — definir timeout em todas as chamadas externas (Claude: 30s, API-Football: 10s)
