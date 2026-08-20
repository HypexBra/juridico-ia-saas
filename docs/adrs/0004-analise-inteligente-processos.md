# 0004 — Análise Inteligente de Processos (Fase 2 "Caso Inteligente")

## Status

Proposto (2026-08-20)

## Contexto

Fase 1 ("Caso Inteligente", migrations `0022`-`0029`) já criou o esqueleto de dados do
caso (`pessoas_caso`, `eventos_caso`, `teses_caso`, `tarefas_caso`, `memoria_ia_caso`,
`caso_jurisprudencia_citada`). Fase 2 precisa: o advogado faz upload de um documento
(PDF/DOCX/imagem) vinculado a uma `ficha_caso`, a IA lê o documento e devolve 12 seções
estruturadas (resumo executivo, linha do tempo, pessoas/partes, documentos encontrados,
questões jurídicas, teses possíveis, evidências, contradições, informações ausentes,
riscos, prazos, próximas ações, perguntas a investigar), cada afirmação rastreável até o
trecho/página de origem, e sem alucinação (o que não está no documento é marcado como
ausente/incerto, nunca inventado).

Precedentes diretos já existentes no repositório que моldam esta decisão:

- `app/app/redline/actions.ts` + `lib/redline/prompt.ts`: chamada de IA síncrona a partir de
  uma Server Action, `responseSchema` nativo do Gemini + validação Zod fail-closed
  (`parsearRespostaRedline` devolve `null` em vez de salvar resposta parcial), documento do
  usuário tratado como DADO delimitado por marcadores (anti-prompt-injection), campo
  `trechoOriginal` citando o texto de origem, contagem de risco sempre recalculada em código
  (nunca aceita o número que a IA disser). É o template mais próximo do que a Fase 2 precisa.
- `app/app/fichas/actions.ts#gerarAnaliseIaAction` + `lib/casos/teses.ts`: análise de IA já
  grava direto em `teses_caso` (sem gate de aprovação humana via `propostas_acao`) — toda
  tese nasce com status `em_avaliacao`, nunca sobrescreve, sempre soma uma linha nova
  auditável. É o precedente de "IA escreve direto, mas com status provisório e reversível
  pelo advogado", distinto do gate de `propostas_acao` usado para `update_ficha`/`update_prazo`
  (mutações destrutivas sobre registro existente).
- `lib/casos/timeline.ts#registrarEventoCaso` e `lib/casos/pessoas.ts` já existem como
  helpers puros/testáveis de escrita em `eventos_caso`/`pessoas_caso` — reaproveitáveis
  diretamente, sem nova abstração.
- `lib/ia/gemini.ts`: `responseSchema` já desliga tools automaticamente; cadeia de modelos
  com fallback de quota (429) já implementada; teto de `maxOutputTokens`/`thinkingBudget` já
  é prática do projeto.
- Não existe fila/job assíncrono no projeto hoje — só `app/api/cron/*` (Vercel Cron,
  execução agendada em lote, não sob demanda do usuário). `vercel.json` só tem 2 crons.
- `lib/rag/extrair-texto.ts` usa `unpdf`/`extractText(..., { mergePages: true })` — perde
  número de página. `package.json` tem `docx` (só para GERAR .docx via `Packer`, não lê) e
  não tem nenhuma lib de leitura de DOCX nem de OCR.

## Decisão

### 1. Schema — 1 tabela "resultado" + citação embutida no JSON, sem tabela de chunks separada

Nova tabela `analises_processo` (migration `0030`), 1 linha por upload analisado:

```sql
create table analises_processo (
  id                uuid primary key default gen_random_uuid(),
  escritorio_id     uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id     uuid not null references fichas_caso(id) on delete cascade,
  nome_arquivo      varchar(255) not null,
  tipo_arquivo      varchar(10) not null check (tipo_arquivo in ('pdf','docx','imagem')),
  tamanho_bytes     integer not null,
  status            varchar(20) not null default 'processando'
                      check (status in ('processando','pronto','erro')),
  resultado_analise jsonb,              -- estrutura de ResultadoAnaliseProcesso (12 seções)
  modelo_ia_usado   varchar(50),
  erro              text,
  criado_por        uuid references perfis(id) on delete set null,
  criado_em         timestamptz not null default now(),
  processado_em     timestamptz
);
```

Sem tabela de "trechos-fonte" normalizada. Cada item que carrega uma afirmação (evento da
timeline, pessoa, tese, risco, prazo etc.) já embute `trechoOriginal` (citação literal) +
`pagina` (nullable) + `certeza` diretamente no próprio objeto JSON — exatamente o padrão já
usado em `ClausulaAnalisada.trechoOriginal` do redline. Justificativa: o documento inteiro
cabe no prompt em uma única chamada (ver seção Limites), não há chunking/RAG nesta feature,
logo não há "chunk_id" a normalizar; uma tabela de citações só adicionaria um join sem
benefício (mesmo raciocínio do ADR 0001 contra `planos_features`). Rastreabilidade na UI é
resolvida em client-side: clicar numa afirmação abre um painel com o `trechoOriginal` +
`pagina`, sem precisar carregar o documento inteiro de novo.

### 2. Write-back em Fase 1 — automático e direto, exceto prazos (gate humano)

- `pessoas_caso`, `eventos_caso`, `teses_caso`: a análise grava direto, reusando os helpers
  puros já existentes (`registrarEventoCaso`, `lib/casos/pessoas.ts`, e uma nova
  `montarTeseCasoDaAnaliseProcesso` em `lib/casos/teses.ts` seguindo o padrão de
  `montarTeseCasoDaAnaliseIa`). Mesma justificativa do precedente de Fase 1: são escritas
  ADITIVAS (nunca sobrescrevem registro existente), com proveniência explícita
  (`eventos_caso.origem = 'documento'`, `referencia_id = analise.id`; teses nascem
  `em_avaliacao`) e reversíveis pelo advogado (editar/excluir manualmente já é suportado).
  Aplicar aqui o gate de `propostas_acao` seria inconsistente com o que a Fase 1 já decidiu
  para o mesmo tipo de dado e adicionaria fricção sem reduzir risco real.
- `prazos`: NÃO grava direto. Prazo tem peso jurídico/perda de direito se errado — usa o gate
  já existente de `propostas_acao` (`tipo: "create_prazo"`), mesmo pipeline do chat. Cada
  prazo identificado na seção 10 vira uma proposta pendente; o advogado aprova/rejeita antes
  de virar um `Prazo` real. Único ponto de escrita de Fase 2 com aprovação humana obrigatória.
- Seções sem tabela correspondente hoje (resumo executivo, documentos encontrados, questões
  jurídicas, evidências, contradições, informações ausentes, riscos, próximas ações,
  perguntas a investigar) ficam só dentro de `resultado_analise` — exibidas na UI da análise,
  sem duplicar em outras tabelas.

### 3. Extração de texto — por tipo de arquivo, sem introduzir RAG/chunking

- **PDF**: reaproveita `unpdf`, mas nova função `extrairTextoDePdfPorPagina` (
  `lib/rag/extrair-texto.ts`) usando `extractText(pdf, { mergePages: false })` — preserva
  página por página (necessário para o campo `pagina` de cada citação; a função existente
  `extrairTextoDePdf`, usada por `base-conhecimento`, mescla páginas e fica intocada).
  PDF escaneado sem texto extraível (mesmo caso que `base-conhecimento` já trata como erro):
  fora do escopo do v1 — erro explícito orientando reenvio como imagem.
- **DOCX**: `docx` (já no `package.json`) só GERA .docx via `Packer`, não lê. Decisão: nova
  dependência `mammoth` (`extractRawText`, MIT, sem binário nativo, leitura simples de texto
  corrido) — não extrai número de página (DOCX não tem paginação fixa como PDF); citação para
  DOCX usa só `trechoOriginal`, com `pagina: null`.
- **Imagem** (jpg/png, ex.: foto de documento): sem OCR — envia os bytes direto pro Gemini
  como parte multimodal (`inlineData`, mimeType + base64), que já lê imagem nativamente. Não
  há precedente disso em `lib/ia/gemini.ts` hoje (só texto); ver decisão de implementação no
  item 6.

### 4. Prompt / schema de saída da IA

Novo módulo `lib/analise-processo/prompt.ts`, mesmo padrão de `lib/redline/prompt.ts`:

- `ANALISE_PROCESSO_SYSTEM_PROMPT`: persona de analista jurídico que SÓ lê o documento
  fornecido e devolve JSON; documento delimitado por marcadores
  `===INÍCIO DO DOCUMENTO===`/`===FIM DO DOCUMENTO===`, tratado como DADO nunca como
  instrução (mesmo guard anti-prompt-injection do redline, adaptado).
- `RESPONSE_SCHEMA` (Gemini `Schema` nativo, `responseMimeType: application/json`): objeto
  com as 12 chaves (`resumoExecutivo`, `linhaDoTempo[]`, `pessoasPartes[]`,
  `documentosEncontrados[]`, `questoesJuridicas[]`, `tesesPossiveis[]`, `evidencias[]`,
  `contradicoes[]`, `informacoesAusentes[]` — array de strings livre, sem citação (é
  justamente o que NÃO está no documento), `riscos[]`, `prazosIdentificados[]`,
  `proximasAcoes[]`, `perguntasInvestigar[]`). Todo item de array que representa um fato
  extraído do documento tem 3 campos obrigatórios: `trechoOriginal: string` (citação literal
  ou paráfrase muito próxima), `pagina: integer | null`, `certeza: enum("confirmado",
  "inferido", "nao_encontrado")`.
- Zod parser fail-closed (`parsearRespostaAnaliseProcesso`), mesmo padrão de
  `parsearRespostaRedline`: `safeParse` — se não bater 100% com o schema, devolve `null` e a
  action falha explicitamente, nunca persiste resultado parcial/adulterado.

### 5. Guardrails contra alucinação

- `certeza: "nao_encontrado"` é o valor explícito e obrigatório quando o documento não dá
  base para preencher um campo — a instrução do system prompt proíbe "confirmado"/"inferido"
  sem `trechoOriginal` correspondente (validado também em código: `zod .refine()` rejeita
  `certeza !== "nao_encontrado"` com `trechoOriginal` vazio).
  "informacoesAusentes" é o espaço dedicado para o modelo listar lacunas relevantes ao invés
  de preencher os outros campos com suposição.
  "inferido" existe para deduções razoáveis (ex.: prazo calculado a partir de uma data de
  intimação explícita) — sempre com `trechoOriginal` da premissa usada.
- Mesma barreira estrutural do redline: `usaSchema = true` já desliga `tools`/`googleSearch`
  no Gemini (a API não aceita as duas coisas juntas) — a resposta só pode vir do documento
  fornecido no prompt, nunca de busca externa "temperando" a análise.
- Documento tratado como DADO, nunca instrução (mesmo texto de guarda do redline) —
  documento jurídico de terceiro é a superfície de prompt-injection mais provável desta
  feature.
- UI nunca deve apresentar um campo com `certeza: "nao_encontrado"` como fato — precisa de
  affordance visual distinta (ex.: badge "não encontrado no documento"), requisito passado ao
  `senior-engineer` na Onda 2.

### 6. Limites

- Tamanho de upload: mesmo teto de `base-conhecimento` — 15MB (`MAX_TAMANHO_ARQUIVO_ANALISE`).
- Tamanho de texto extraído: teto de 300.000 caracteres (~75k tokens, bem acima do
  `TAMANHO_MAXIMO_CONTRATO = 40_000` do redline porque processos costumam ser mais longos que
  contratos, mas ainda finito) processado em UMA chamada — sem chunking/map-reduce nesta
  v1. Acima do teto: erro explícito pedindo para dividir o envio, documentado como limitação
  de v1 (mesmo texto avisado no redline `TAMANHO_MAXIMO_CONTRATO`) — se isso se mostrar
  insuficiente na prática, vira gatilho de um ADR novo introduzindo map-reduce, não uma
  correção silenciosa aqui.
- Custo/tokens: chamada tratada como "tarefa complexa" (mesmo tier de `MODELO_PRO` em
  `lib/ia/gemini.ts`) com `maxOutputTokens` maior que o padrão atual (12 seções ricas exigem
  mais que os 8192 de `MAX_OUTPUT_TOKENS_PRO`; usar 16384) e `thinkingBudget` elevado (2048) —
  constantes novas e isoladas (`MAX_OUTPUT_TOKENS_ANALISE_PROCESSO`,
  `THINKING_BUDGET_ANALISE_PROCESSO`), sem alterar os tetos do chat.
- Processamento: **síncrono**, dentro da própria Server Action — não existe fila/job no
  projeto hoje (só Vercel Cron agendado) e introduzir uma agora seria over-engineering para o
  volume esperado (1 análise por vez, por advogado, sob demanda). Mitigação de timeout:
  `export const maxDuration = 120` na rota que hospeda a Server Action (mesmo mecanismo já
  usado em `app/api/cron/sincronizar-djen/route.ts`, com `maxDuration = 60`); a linha em
  `analises_processo` é criada com `status = 'processando'` ANTES da chamada de IA, então se a
  function morrer por timeout a UI mostra "processando" (não erro silencioso) e o advogado
  pode tentar de novo. Se documentos maiores/tempos maiores se tornarem comuns o suficiente
  para estourar o teto do plano Vercel, isso é o gatilho explícito para um ADR futuro que
  supere este item introduzindo job assíncrono real (ex.: Supabase Edge Function ou fila) —
  não resolvido preventivamente agora (mesmo espírito "monólito modular primeiro" do ADR 0001).

## Consequências

**Positivas**

- Reaproveita 100% dos padrões já validados em produção (redline + Fase 1), zero abstração
  nova de infraestrutura (sem fila, sem tabela de chunks) — menor superfície de bugs.
- Rastreabilidade (`trechoOriginal`+`pagina`+`certeza`) é auditável linha a linha sem exigir
  join extra.
- Guardrail anti-alucinação é estrutural (schema + zod + tools desligadas), não apenas uma
  instrução de prompt "torça para não inventar".
- Prazo continua com aprovação humana obrigatória — nenhum risco de perda de prazo real por
  erro de extração automática.

**Negativas**

- Documento muito grande (>300k caracteres extraídos) falha explicitamente em vez de ser
  processado em partes — limitação conhecida de v1.
- Chamada síncrona de até ~120s é uma experiência de espera longa para o advogado; sem UI de
  progresso granular (só "processando"/"pronto"/"erro").
- PDF escaneado sem camada de texto não é suportado nesta v1 (usuário precisa reenviar como
  imagem individual).
- Nova dependência (`mammoth`) e nova função multimodal em `lib/ia/gemini.ts` aumentam a
  superfície de manutenção do módulo de IA.

## Alternativas consideradas

1. **Tabela normalizada de "trechos/citações" (`analise_processo_citacoes`) com FK por
   afirmação** — mais "correto" relacionalmente, mas exige join complexo (1 análise → N
   seções → N citações) sem necessidade real hoje (nenhuma consulta agregada por citação é
   prevista); rejeitada pelo mesmo racional de custo/benefício do ADR 0001.
2. **Todo write-back de Fase 1 via `propostas_acao` (gate humano em tudo, não só prazo)** —
   mais conservador, mas contradiz a decisão já tomada e em produção em
   `gerarAnaliseIaAction`/`teses_caso` (grava direto com status provisório). Adicionar
   fricção aqui e não lá seria inconsistente sem ganho de segurança adicional — rejeitada.
3. **Job assíncrono desde já (fila/worker dedicado)** — resolveria o limite de timeout de
   forma mais robusta, mas introduz infraestrutura nova (fila, worker, polling) sem que o
   projeto tenha hoje volume que justifique — over-engineering nesta fase; fica documentado
   como gatilho de ADR futuro.
4. **OCR próprio para PDF escaneado (ex.: Tesseract via lib Node)** — resolveria o gap de PDF
   sem texto, mas adiciona dependência pesada (frequentemente binário nativo) para um caso de
   uso ainda não confirmado como frequente; Gemini multimodal via upload direto de imagem já
   cobre o caso mais comum (foto de documento) sem essa dependência. Rejeitada por ora.

## Plano de implementação (ondas)

**Onda 0 — `database`** (sequencial, bloqueia as demais):
- `supabase/migrations/0030_analises_processo.sql` (tabela + índices + RLS).
- `lib/types.ts`: tipo `AnaliseProcesso` + sub-tipos das 12 seções (`ResultadoAnaliseProcesso`
  em `lib/analise-processo/tipos.ts`, espelhando `lib/redline/tipos.ts`).
- `lib/planos/gating.ts`: nova feature `analise_inteligente_processo` (Pro-only) em
  `FEATURES_PREMIUM`.

**Onda 1 — `ai-engineer`** (paralelo entre si, depende só da Onda 0):
- `lib/rag/extrair-texto.ts`: `extrairTextoDePdfPorPagina`.
- `package.json`: adicionar `mammoth`; `lib/analise-processo/extracao-docx.ts`.
- `lib/analise-processo/extracao.ts`: dispatcher por `tipo_arquivo`.
- `lib/analise-processo/prompt.ts`: system prompt, `RESPONSE_SCHEMA`, zod parser.
- `lib/ia/gemini.ts`: extrair helper de retry/cadeia-de-modelos reaproveitável; nova função
  multimodal one-shot (texto ou texto+imagem) com `responseSchema`.
- `lib/casos/teses.ts`: `montarTeseCasoDaAnaliseProcesso`.

**Onda 2 — `senior-engineer`** (depende da Onda 1):
- `app/app/fichas/[id]/analise-processo-actions.ts`: `analisarDocumentoProcessoAction`
  (gating → validação de arquivo → extração → chamada IA → parse fail-closed → persiste
  `analises_processo` → write-back em `pessoas_caso`/`eventos_caso`/`teses_caso` →
  `propostas_acao` para prazos → `uso_ia`).
- `export const maxDuration = 120` na rota/segmento que hospeda a action.
- `components/app/analise-processo-form.tsx` (upload) e
  `components/app/analise-processo-resultado.tsx` (12 seções, badge de `certeza`, clique no
  item abre `trechoOriginal`/`pagina`).
- `app/app/fichas/[id]/analise-processo/page.tsx` (ou aba na página da ficha).

**Onda 3 — revisão** (paralelo): `security` (upload de arquivo arbitrário, prompt injection
via documento, RLS da nova tabela) + `qa` (casos: PDF nativo, PDF escaneado, DOCX, imagem,
documento > 300k chars, resposta fora do schema) + `techlead`.

## Arquivos lidos para este design

`lib/types.ts`, `docs/adrs/0001-plano-gating-monolito-modular.md`,
`app/app/base-conhecimento/actions.ts`, `lib/ia/gemini.ts`, `package.json`,
`lib/ia/rag-prompt.ts`, `lib/rag/ingestao.ts`, `app/api/cron/sincronizar-djen/route.ts`,
`app/app/redline/actions.ts`, `lib/redline/prompt.ts`, `lib/redline/tipos.ts`,
`vercel.json`, `lib/rag/extrair-texto.ts`, `supabase/migrations/0017_analises_risco_contratual.sql`,
`lib/planos/gating.ts`, `lib/casos/timeline.ts`, `lib/casos/teses.ts`, `lib/casos/pessoas.ts`,
`app/app/fichas/actions.ts` (trecho de `gerarAnaliseIaAction`), listagem de
`supabase/migrations/*.sql`.
