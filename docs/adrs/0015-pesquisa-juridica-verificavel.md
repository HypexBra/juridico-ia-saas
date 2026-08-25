# 0015 — Pesquisa Jurídica Verificável (Fase 7)

Data: 2026-08-22 · Status: Aceito

## Contexto

A regra de produto do projeto é "a IA nunca inventa jurisprudência". Até aqui
existia apenas: (1) grounding `googleSearch` do Gemini no chat (sem camada de
verificação — evidenciado como insuficiente: LLMs continuam fabricando citações
mesmo com busca ativa); (2) ingestão MANUAL de jurisprudência para o RAG
(`lib/rag/jurisprudencia.ts`, migration 0008). O handoff da sessão anterior
condicionava o desenho à confirmação do schema real do Portal de Dados Abertos
do STJ.

## Decisão

1. **Fonte oficial confirmada**: os "Espelhos de Acórdão" do STJ
   (dadosabertos.web.stj.jus.br, CKAN) publicam mensalmente JSON com TEXTO
   INTEGRAL de ementas + metadados estruturados (processo, registro, classe,
   órgão julgador, relator, datas, tese, tema), para TODOS os órgãos julgadores.
   Licença CC-BY. Schema validado baixando arquivo real (20260630.json,
   Corte Especial).
2. **Ingestão automática idempotente** (`lib/jurisprudencia/stj.ts` + cron
   `/api/cron/sync-stj`, mensal dia 3 às 04h UTC): baixa o arquivo mais recente
   de cada órgão ainda não ingerido (controle em `fontes_stj_sync`), faz upsert
   em `jurisprudencias` (chave natural tribunal+numero_processo preservada) e
   indexa as ementas no RAG vetorial compartilhado. Novos campos oficiais
   (`orgao_julgador`, `numero_registro`, `tese`, `tema`, `origem`) na migration 0042.
3. **Busca híbrida**: lexical (tsvector pt-BR gerado sobre processo+ementa,
   índice GIN) primária + semântica (RAG existente filtrado a
   `fonte_tipo='jurisprudencia'`) como reforço. Degradar, nunca quebrar:
   se a migration não rodou, fallback transparente para ILIKE.
4. **Verificador de citações** (`lib/jurisprudencia/verificacao.ts`): extrai
   citações (nº CNJ com validação MOD 97-10 real, nº canônico STJ, súmula,
   tema repetitivo) e confere contra a base local, classificando VERIFICADA /
   NÃO_VERIFICADA / MAL_FORMADA. "Não verificada" ≠ falsa — é status de
   verificação LOCAL, apresentado explicitamente ao usuário, nunca silenciado.
5. **Comparador de decisões**: seleção de até 3 decisões → tabela estruturada
   lado a lado (livre) + síntese por IA (Pro, chave `pesquisa_juridica_avancada`,
   prompt com guardrail anti-invenção e saída JSON estruturada).

## Consequências

- Cobertura HONESTA: só STJ hoje (STF segue sem API/dados abertos confirmados).
  A UI comunica a fonte; nada finge cobertura nacional.
- O verificador depende da base local crescer (cron mensal). Citações reais
  podem aparecer como não verificadas até a base amadurecer — comportamento
  documentado na UI.
- Chat ainda usa grounding googleSearch; a integração verificador→chat fica
  para um próximo ciclo (o módulo já é importável por qualquer fluxo).
