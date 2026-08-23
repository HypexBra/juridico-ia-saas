# MIGRATIONS PENDENTES — aplicar no Supabase (SQL Editor)

> Estado em 2026-08-23. Verificado via API REST: as tabelas de 0038–0041
> **não existem** em produção; 0037 é uma alteração de função (aplicar junto).
> As migrations `0001`–`0036` já foram aplicadas nas sessões anteriores.

## Ordem de aplicação (copiar/colar na ordem, um arquivo por vez)

1. `supabase/migrations/0037_recencia_busca_chunks.sql` — recência no ranking do RAG
2. `supabase/migrations/0038_convites_equipe.sql` — conta de equipe por escritório
3. `supabase/migrations/0039_advogado_contra.sql` — Fase 5 (Advogado do Contra)
4. `supabase/migrations/0040_convites_equipe_hardening.sql` — trigger de imutabilidade
5. `supabase/migrations/0041_estrategia_caso.sql` — Fase 6 (Estrategista)
6. `supabase/migrations/0042_pesquisa_juridica_stj.sql` — Fase 7 (Pesquisa Jurídica)
7. `supabase/migrations/0043_tarefas_prioridade.sql` — prioridade em tarefas
8. `supabase/migrations/0044_workflows.sql` — Fase 8 (Workflow Engine)
9. `supabase/migrations/0045_observabilidade_uso.sql` — Fase 27: colunas modelo/duração/origem em uso_ia + índice (NOVA — sessão 6)
10. `supabase/migrations/0046_memoria_escritorio.sql` — Fase 17: diretrizes_ia/tom_escrita/clausulas_padrao em escritorios (NOVA — sessão 6)
11. `supabase/migrations/0047_webhooks.sql` — Fase 22: webhook_endpoints + webhook_deliveries com RLS (NOVA — sessão 7)

## Depois das migrations (2 minutos)

- Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
  adicionar `https://juridico-ia-saas.vercel.app/auth/callback`
  (sem isso convite de equipe e "redefinir senha" quebram).
- Confirmar webhook do Stripe apontando para `/api/webhooks/stripe`.
- O cron mensal do STJ (`/api/cron/sync-stj`, dia 3 às 04h UTC) já foi
  registrado no `vercel.json` deste commit — o primeiro deploy após o push
  cria o job automaticamente. Para popular a base AGORA sem esperar o cron:
  `curl -X POST https://juridico-ia-saas.vercel.app/api/cron/sync-stj -H "Authorization: Bearer $CRON_SECRET"`
  (ou logue como owner e faça POST autenticado).

## Como verificar que deu certo

```sql
-- deve retornar as tabelas novas:
select table_name from information_schema.tables
where table_schema='public' and table_name in
('convites_equipe','analises_advogado_contra','estrategias_caso','fontes_stj_sync','webhook_endpoints');
select prioridade from tarefas_caso limit 1; -- coluna existe?
-- 0045/0046 (sessão 6):
select modelo, duracao_ms, origem from uso_ia limit 1; -- colunas existem (linhas antigas: NULL é esperado)
select diretrizes_ia, tom_escrita, clausulas_padrao from escritorios limit 1; -- colunas existem (default '')
```
