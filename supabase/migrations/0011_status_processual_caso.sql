-- Projeção de recebíveis de honorário de êxito (financeiro): o schema atual
-- não modela o RESULTADO/andamento do caso em nenhum lugar. `fichas_caso` só
-- tem `lida` (boolean de inbox) e `nivel_risco` (score de IA, 0008); ambos
-- são ortogonais a "o processo já foi julgado/acordado e o cliente ganhou,
-- perdeu ou o caso segue em andamento". `conversas.status`
-- (ativa/triagem_completa/encerrada, 0001) também não serve: é o status do
-- CHAT de triagem que originou a ficha, não do processo judicial em si —
-- uma conversa pode encerrar muito antes do processo terminar.
--
-- Sem essa coluna é impossível diferenciar, para um contrato de honorário de
-- êxito (`contratos_honorario.tipo = 'exito'`) sem parcelas geradas ainda
-- (caso comum: o valor só é conhecido/parcelado depois do resultado, ver
-- comentário em `parcelas_honorario` já existente e em
-- `components/app/contrato-honorario-card.tsx`), se o valor esperado é uma
-- ESTIMATIVA sujeita a não se concretizar (caso em andamento) ou uma
-- expectativa já CONFIRMADA que só aguarda o parcelamento formal (caso
-- ganho/com acordo homologado) — exatamente a distinção pedida para a
-- projeção de recebíveis. Por isso esta migration adiciona a coluna,
-- expand-only, nullable-safe via default, sem quebrar nenhuma ficha
-- existente.
alter table fichas_caso add column if not exists status_processual varchar(20)
  not null default 'em_andamento'
  check (status_processual in ('em_andamento', 'ganho', 'acordo', 'perdido', 'arquivado'));

alter table fichas_caso add column if not exists status_processual_atualizado_em timestamptz;

create index if not exists idx_fichas_status_processual on fichas_caso(status_processual);
