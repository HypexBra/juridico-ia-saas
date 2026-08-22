-- 0043 — Prioridade em tarefas de caso (Fase 1/19 — lista de tarefas real)
--
-- O usuário pediu explicitamente: "quero uma lista de tarefas onde a pessoa
-- consiga adicionar o que pode fazer, PRIORIDADE, se já fez ou não e etc".
-- `tarefas_caso` já tinha status (pendente/em_andamento/concluida = "se já
-- fez"); faltava a dimensão de prioridade para ordenar o trabalho do dia.

alter table tarefas_caso
  add column if not exists prioridade varchar(10) not null default 'media'
    check (prioridade in ('baixa', 'media', 'alta'));

comment on column tarefas_caso.prioridade is 'Prioridade operacional definida pela equipe: baixa < media < alta. Ordenação do dashboard/ficha usa prioridade desc, depois prazo mais próximo.';

create index if not exists idx_tarefas_caso_prioridade on tarefas_caso(prioridade);
