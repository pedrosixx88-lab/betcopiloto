-- ============================================================
-- Segurança: habilitar RLS nas tabelas criadas após o schema inicial
-- Rodar no Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── SUBSCRIPTIONS ──────────────────────────────────────────
alter table if exists subscriptions enable row level security;

drop policy if exists "Usuário lê próprias subscriptions" on subscriptions;
create policy "Usuário lê próprias subscriptions"
  on subscriptions for select
  using (auth.uid() = user_id);

-- Insert/update/delete: apenas service_role (webhooks de pagamento)

-- ── AVALIACOES ─────────────────────────────────────────────
alter table if exists avaliacoes enable row level security;

drop policy if exists "Usuário lê próprias avaliações" on avaliacoes;
create policy "Usuário lê próprias avaliações"
  on avaliacoes for select
  using (auth.uid() = user_id);

drop policy if exists "Usuário insere próprias avaliações" on avaliacoes;
create policy "Usuário insere próprias avaliações"
  on avaliacoes for insert
  with check (auth.uid() = user_id);

-- ── FIXTURE_CACHE ──────────────────────────────────────────
-- Sem dados de usuário — acesso apenas via service_role (server-side)
alter table if exists fixture_cache enable row level security;

-- Nenhuma policy de select para authenticated: cache lido apenas pelo server

-- ── AFFILIATES ─────────────────────────────────────────────
alter table if exists affiliates enable row level security;

drop policy if exists "Afiliado lê próprios dados" on affiliates;
create policy "Afiliado lê próprios dados"
  on affiliates for select
  using (auth.uid() = user_id);

drop policy if exists "Afiliado atualiza próprios dados" on affiliates;
create policy "Afiliado atualiza próprios dados"
  on affiliates for update
  using (auth.uid() = user_id);

-- ── AFFILIATE_REFERRALS ────────────────────────────────────
alter table if exists affiliate_referrals enable row level security;

drop policy if exists "Afiliado lê próprios referrals" on affiliate_referrals;
create policy "Afiliado lê próprios referrals"
  on affiliate_referrals for select
  using (
    exists (
      select 1 from affiliates
      where affiliates.id = affiliate_referrals.affiliate_id
        and affiliates.user_id = auth.uid()
    )
  );

-- ── PROFILES: adicionar coluna plan_expires_at se não existir ──
alter table if exists profiles add column if not exists plan_expires_at timestamptz;
alter table if exists profiles add column if not exists avaliacoes_gratuitas integer not null default 0;
alter table if exists profiles add column if not exists referred_by text;
alter table if exists profiles add column if not exists asaas_customer_id text;

-- ── Verificação final ──────────────────────────────────────
-- Confirmar que todas as tabelas têm RLS ativado:
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
