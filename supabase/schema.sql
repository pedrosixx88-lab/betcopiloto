-- ============================================================
-- BetCopiloto — Schema inicial
-- Rodar no Supabase SQL Editor
-- ============================================================

-- Enums
create type plan as enum ('free', 'pro');
create type bet_status as enum ('pending', 'won', 'lost', 'void');
create type bet_market as enum ('match_winner', 'over_under', 'both_teams_score', 'handicap', 'correct_score', 'other');

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text,
  avatar_url text,
  plan plan not null default 'free',
  initial_bankroll numeric(10,2) not null default 0,
  current_bankroll numeric(10,2) not null default 0,
  favorite_leagues text[] not null default '{}',
  main_bookmaker text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Usuário lê apenas o próprio perfil"
  on profiles for select
  using (auth.uid() = id);

create policy "Usuário atualiza apenas o próprio perfil"
  on profiles for update
  using (auth.uid() = id);

-- Cria perfil automaticamente após cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- BETS
-- ============================================================
create table bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  home_team text not null,
  away_team text not null,
  league text,
  market bet_market not null,
  selection text not null,
  odd numeric(6,2) not null,
  stake numeric(10,2) not null,
  potential_return numeric(10,2) not null,
  status bet_status not null default 'pending',
  match_date date not null,
  fixture_id integer,
  screenshot_url text,
  bookmaker text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bets enable row level security;

create policy "Usuário lê apenas as próprias apostas"
  on bets for select
  using (auth.uid() = user_id);

create policy "Usuário insere apenas as próprias apostas"
  on bets for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza apenas as próprias apostas"
  on bets for update
  using (auth.uid() = user_id);

create policy "Usuário deleta apenas as próprias apostas"
  on bets for delete
  using (auth.uid() = user_id);

-- Índices
create index bets_user_id_idx on bets(user_id);
create index bets_match_date_idx on bets(match_date);
create index bets_status_idx on bets(status);
create index bets_fixture_id_idx on bets(fixture_id) where fixture_id is not null;

-- ============================================================
-- STORAGE — screenshots de bilhetes
-- ============================================================
insert into storage.buckets (id, name, public)
values ('bet-screenshots', 'bet-screenshots', false);

create policy "Usuário faz upload das próprias screenshots"
  on storage.objects for insert
  with check (
    bucket_id = 'bet-screenshots' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuário lê apenas as próprias screenshots"
  on storage.objects for select
  using (
    bucket_id = 'bet-screenshots' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Usuário deleta apenas as próprias screenshots"
  on storage.objects for delete
  using (
    bucket_id = 'bet-screenshots' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- updated_at automático
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on profiles
  for each row execute procedure public.set_updated_at();

create trigger set_bets_updated_at
  before update on bets
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- PUSH SUBSCRIPTIONS — Milestone 5
-- ============================================================
create table push_subscriptions (
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

-- ============================================================
-- DAILY BRIEFINGS — Milestone 5
-- ============================================================
create table daily_briefings (
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
