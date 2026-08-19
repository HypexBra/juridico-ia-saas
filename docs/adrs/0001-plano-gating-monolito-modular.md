# 0001 — Gating de features premium via matriz estática, não tabela `planos`/`features`

## Status

Aceito (2026-08-19)

## Contexto

O app hoje só tem o plano Free (`escritorios.plano = 'free'|'pro'`, já existente desde a
migration `0001_init.sql`; `LIMITE_MENSAGENS_FREE` em `lib/types.ts` é a única regra de
plano aplicada). Seis features premium serão implementadas numa rodada separada:

1. Redação assistida de peças completas via IA
2. Análise de risco contratual clause-by-clause ("redline")
3. Relatórios/analytics avançados (realization rate, breakdown financeiro)
4. Automação de documento com lógica condicional (mail-merge avançado)
5. API/integrações abertas
6. Portal do cliente rico (chat bidirecional + notificação em tempo real)

Nenhuma conta Stripe existe ainda. Era preciso decidir ONDE mora a regra "este
escritório pode usar esta feature": banco de dados (tabela `planos`/`features` com
join) ou código (matriz estática)?

## Decisão

A checagem de acesso vive em código, numa matriz estática `plano -> Set<Feature>` em
`lib/planos/gating.ts`, consultando apenas a coluna `escritorios.plano` (já existente) e
uma coluna nova `escritorios.features_overrides jsonb` (migration `0012`) para exceções
pontuais (suporte/comercial liberando ou revogando 1 feature de 1 escritório específico
sem mudar o plano dele).

Único ponto de entrada: `escritorioTemAcesso(escritorioId, feature)` (assíncrono, busca no
banco) e `planoTemAcesso(escritorio, feature)` (síncrono, puro, para quando o escritório já
está em memória via `getUsuarioAtual()`). Nenhuma outra parte do app deve reimplementar
essa checagem.

Não foi criada uma tabela `planos` (catálogo de planos) nem `planos_features` (join
plano-feature) nesta rodada.

## Consequências

**Positivas**

- Zero join extra por request — `planoTemAcesso` é O(1) em memória quando o
  `Escritorio` já foi carregado (caso comum: toda página/action autenticada já chama
  `getUsuarioAtual()`, cacheado por request via `React.cache`).
- Único arquivo (`lib/planos/gating.ts`) para auditar toda a lógica de acesso — sem
  checagem de plano espalhada pelo app.
- `features_overrides` cobre o caso real de suporte/comercial sem exigir uma tabela de
  planos completa nem deploy de código.
- Consistente com a RLS já existente (`escritorios_update`, 0001/0012): só `service_role`
  altera `plano`/`features_overrides`, nunca o client.

**Negativas**

- Adicionar uma feature nova ou um 3º plano exige alterar código + deploy (`FEATURES_PREMIUM`
  e `MATRIZ_PLANO_FEATURES` em `lib/planos/gating.ts`), não é configurável via painel
  administrativo/banco em runtime.
- Se o catálogo de planos crescer além de "free"/"pro" (ex: trial, enterprise, per-seat),
  a matriz estática fica menos ergonômica — nesse ponto vale revisitar via novo ADR que
  supere este.

## Alternativas consideradas

1. **Tabela `planos` + tabela `planos_features` (join)** — mais flexível (mudar
   permissão sem deploy), mas over-engineering para 2 planos e 6 features fixas nesta
   fase; adiciona 1 join a cada checagem de gating (potencialmente centenas de chamadas
   por dia por escritório) sem benefício real hoje. Rejeitada por complexidade
   desproporcional ao problema atual.
2. **Coluna array de features direto em `escritorios` (sem conceito de "plano")** —
   perderia o conceito de plano nomeado (usado em UI, billing, `LIMITE_MENSAGENS_FREE`) e
   tornaria toda troca de tier uma migração de dados em massa em vez de 1 UPDATE de
   enum. Rejeitada.
3. **Checagem de plano duplicada em cada action/rota (sem helper central)** — é o
   status quo informal antes desta ADR (ex: cada action já checava `LIMITE_MENSAGENS_FREE`
   isoladamente). Viola a regra de "não duplicar checagem de plano espalhada" definida
   para este projeto. Rejeitada.
