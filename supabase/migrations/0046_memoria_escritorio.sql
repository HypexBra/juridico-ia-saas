-- 0046 — Memória do escritório (Fase 17 do prompt mestre)
-- Diretrizes de escrita, tom e cláusulas padrão injetadas no contexto da IA.
-- Colunas vivem em escritorios: herdam a RLS existente da tabela.

alter table escritorios
  add column if not exists diretrizes_ia text not null default '';
alter table escritorios
  add column if not exists tom_escrita varchar(40) not null default 'formal';
alter table escritorios
  add column if not exists clausulas_padrao text not null default '';
