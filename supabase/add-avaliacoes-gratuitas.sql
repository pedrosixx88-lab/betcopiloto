-- Adiciona coluna para controlar uso gratuito do avaliador
alter table profiles
  add column if not exists avaliacoes_gratuitas integer not null default 0;
