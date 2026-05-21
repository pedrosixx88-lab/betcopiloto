-- ============================================================
-- Milestone 4 — Cache de análises de jogos
-- Rodar no Supabase SQL Editor
-- ============================================================

create table game_analyses (
  id uuid primary key default gen_random_uuid(),
  fixture_id integer not null unique,
  home_team text not null,
  away_team text not null,
  league text not null,
  match_date date not null,
  analysis text not null,          -- texto completo gerado pelo Claude
  summary jsonb not null default '{}', -- { tip, confidence, markets: [...] }
  created_at timestamptz not null default now()
);

-- Índices
create index game_analyses_fixture_id_idx on game_analyses(fixture_id);
create index game_analyses_match_date_idx on game_analyses(match_date);

-- RLS — análises são públicas (cache compartilhado entre todos os usuários)
alter table game_analyses enable row level security;

create policy "Qualquer usuário autenticado lê análises"
  on game_analyses for select
  using (auth.role() = 'authenticated');

create policy "Apenas service role insere análises"
  on game_analyses for insert
  with check (auth.role() = 'service_role');

create policy "Apenas service role atualiza análises"
  on game_analyses for update
  using (auth.role() = 'service_role');
