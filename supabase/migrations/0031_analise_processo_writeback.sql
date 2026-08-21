-- Onda 2 (ADR 0004, "Caso Inteligente" Fase 2) — idempotência do write-back
-- automático de `analises_processo` para `pessoas_caso`/`eventos_caso`/
-- `teses_caso` (+ `propostas_acao` para prazos, ver seção 2 do ADR).
--
-- `writeback_aplicado_em` marca o momento em que
-- `aplicarWriteBackAnaliseProcessoAction` (app/app/fichas/[id]/analise-processo-actions.ts)
-- terminou de processar a análise. `null` = write-back ainda não aplicado
-- (ou análise ainda não está `pronto`). Uma vez preenchida, a action se
-- recusa a reaplicar — evita duplicar pessoas/eventos/teses/propostas de
-- prazo se o usuário clicar "Aplicar ao caso" mais de uma vez na mesma
-- análise.
alter table analises_processo
  add column if not exists writeback_aplicado_em timestamptz;
