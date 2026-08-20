-- Soft delete de `fichas_caso` — Fase 1 do "Caso Inteligente".
--
-- Hoje `excluirFichaAction` faz DELETE físico, cascateando pra
-- `contratos_honorario` (e tudo que depende dela) — perda de dado real
-- (financeiro, histórico) sem chance de recuperação. A partir desta
-- migration a coluna existe; a troca de `.delete()` por
-- `.update({ deletado_em: now() })` em `app/app/fichas/actions.ts` é feita
-- em deploy separado (Expand-Contract: schema primeiro, código depois).
--
-- FKs de cascade NÃO são tocadas aqui de propósito — ficha "excluída" some
-- da listagem (via policy de select abaixo) mas contratos/prazos/etc.
-- seguem intactos, prontos para restauração (`deletado_em = null`).
alter table fichas_caso add column if not exists deletado_em timestamptz;

-- Índice parcial: cobre exatamente o padrão de leitura mais comum
-- (listagem de fichas ATIVAS por escritório) sem pagar o custo de indexar
-- as linhas soft-deleted, que saem de circulação na maior parte das queries.
create index if not exists idx_fichas_ativas on fichas_caso(escritorio_id) where deletado_em is null;

-- A policy única "fichas_isolamento" (for all) cobria select/insert/update/
-- delete com a mesma condição. Precisa virar 4 policies por comando porque
-- só o SELECT deve esconder linhas soft-deleted — UPDATE continua liberado
-- (é como a aplicação vai MARCAR `deletado_em`) e DELETE físico continua
-- disponível para rotinas administrativas/expurgo futuro, fora do fluxo
-- normal do usuário.
drop policy if exists "fichas_isolamento" on fichas_caso;

create policy "fichas_select" on fichas_caso
  for select using (escritorio_id = escritorio_atual() and deletado_em is null);

create policy "fichas_insert" on fichas_caso
  for insert with check (escritorio_id = escritorio_atual());

create policy "fichas_update" on fichas_caso
  for update using (escritorio_id = escritorio_atual())
  with check (escritorio_id = escritorio_atual());

create policy "fichas_delete" on fichas_caso
  for delete using (escritorio_id = escritorio_atual());
