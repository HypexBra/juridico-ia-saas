-- 0055 — Leitura cross-tenant de `uso_ia` para o admin da plataforma
-- (Fase 5, alerta de uso razoável no plano Pro). `uso_ia_isolamento`
-- (migration 0001) só permite `escritorio_id = escritorio_atual()`, então
-- o painel /admin/uso-excedente (agregação de custo estimado por escritório
-- Pro no mês corrente) não enxergava nada sem esta policy adicional.
--
-- Mesmo padrão de 0014_admin_plataforma_e_exclusao_conversas.sql: policy
-- permissiva de SELECT, somada (OR) ao isolamento por escritório já
-- existente — nunca remove o isolamento normal de owner/admin/advogado.
create policy "uso_ia_select_admin_plataforma" on uso_ia
  for select using (eh_admin_plataforma());
