-- 0045 — Observabilidade de uso de IA (Fase 27 do prompt mestre)
-- Registra modelo, duração e origem de cada chamada para permitir
-- agregação de custo/latência sem serviços externos (custo zero).

alter table uso_ia add column if not exists modelo varchar(80);
alter table uso_ia add column if not exists duracao_ms integer;
alter table uso_ia add column if not exists origem varchar(40);

create index if not exists idx_uso_ia_criado
  on uso_ia(escritorio_id, criado_em desc);
