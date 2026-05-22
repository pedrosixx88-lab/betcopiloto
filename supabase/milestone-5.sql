-- ============================================================
-- Milestone 5 — Push Subscriptions + Daily Briefings
-- Rodar no Supabase SQL Editor
-- ============================================================

-- Push subscriptions
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "Usuário gerencia próprias subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Briefings diários
create table if not exists daily_briefings (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  content text not null,
  games_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table daily_briefings enable row level security;

create policy "Qualquer usuário autenticado lê briefings"
  on daily_briefings for select
  using (auth.role() = 'authenticated');

create policy "Service role insere briefings"
  on daily_briefings for insert
  with check (true);

create policy "Service role atualiza briefings"
  on daily_briefings for update
  using (true);
