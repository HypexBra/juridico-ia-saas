-- Alerta proativo via WhatsApp: ficha de triagem com urgência "alta" que
-- fica sem contato/resposta do advogado (proxy: `fichas_caso.lida = false`,
-- mesmo sinal já usado em `consultar_status_publico_por_cpf`, 0008) por mais
-- de N horas. Reaproveita o motor de cron de `lembretes_whatsapp_enviados`
-- (0008) como um 3º `tipo_referencia`, mesma idempotência por
-- (tipo_referencia, referencia_id, marco) — nenhuma tabela nova.

-- Destino do alerta é INTERNO (equipe do escritório), diferente dos outros
-- 2 tipos de lembrete (cliente final via `fichas_caso.telefone`/
-- `parcelas_honorario` -> `ficha_caso.telefone`). Por isso o número de
-- destino não vem da ficha, e sim de uma coluna nova e opcional no próprio
-- canal do escritório — nullable porque a feature é opt-in: sem essa coluna
-- preenchida, o alerta de ficha urgente simplesmente não tem para onde ir e
-- é pulado silenciosamente (mesmo padrão de "canal não configurado").
alter table canais_whatsapp_escritorio
  add column if not exists telefone_alerta_urgencia varchar(20);

-- Expande os enums fechados por CHECK para aceitar o novo tipo de
-- referência ("ficha_urgente", aponta para `fichas_caso.id`) e o novo marco
-- ("sem_resposta" — dispara 1x só por ficha, a unique constraint já
-- existente impede repetição em execuções futuras do cron mesmo que a ficha
-- continue não lida por dias).
alter table lembretes_whatsapp_enviados drop constraint if exists lembretes_whatsapp_enviados_tipo_referencia_check;
alter table lembretes_whatsapp_enviados add constraint lembretes_whatsapp_enviados_tipo_referencia_check
  check (tipo_referencia in ('prazo', 'parcela_honorario', 'ficha_urgente'));

alter table lembretes_whatsapp_enviados drop constraint if exists lembretes_whatsapp_enviados_marco_check;
alter table lembretes_whatsapp_enviados add constraint lembretes_whatsapp_enviados_marco_check
  check (marco in ('d3', 'd1', 'd0', 'atraso', 'sem_resposta'));

-- Índice parcial: a query do cron filtra exatamente por esta combinação
-- (urgencia = 'alta' and lida = false) em todas as execuções — um índice
-- parcial fica pequeno (só as fichas urgentes ainda não lidas de todo o
-- banco) e não penaliza escritas de fichas com urgência normal/baixa.
create index if not exists idx_fichas_urgencia_alta_nao_lida
  on fichas_caso(escritorio_id, criado_em)
  where urgencia = 'alta' and lida = false;
