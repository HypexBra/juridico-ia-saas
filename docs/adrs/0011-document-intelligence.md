# 0011 — Document Intelligence (Fase 3)

## Status

Proposto (2026-08-21)

## Contexto

Ciclo 1 (Fase 0 Auditoria, Fase 1 "Caso Inteligente", Fase 2 Análise de Processos) está em
produção. Fase 3 pede duas capacidades novas, ambas sobre documentos avulsos (não
necessariamente vinculados a uma `ficha_caso` aberta):

1. **Análise individual e em lote de documento**: resumir, explicar, extrair informações
   (datas, valores, partes), encontrar inconsistências, identificar cláusulas/riscos,
   classificar o tipo de documento.
2. **Comparador de documentos**: Contrato A × Contrato B → cláusulas adicionadas/removidas/
   alteradas, riscos, recomendações.

Três precedentes diretos já em produção moldam esta decisão, cada um cobrindo uma fatia
diferente do pedido — nenhum cobre o pedido inteiro:

- `app/app/redline/` + `lib/redline/{prompt,tipos}.ts` (migration `0017`,
  `analises_risco_contratual`): análise cláusula-por-cláusula (`veredito`: ok/atenção/
  risco_alto) — mas **só aceita texto colado**, sem upload, sem classificação de tipo de
  documento, sem extração de datas/valores/partes, sem comparação. Feature Pro já com nav
  item próprio e usuários reais.
- `lib/analise-processo/{extracao,prompt,analisar,tipos}.ts` (ADR 0004, migrations
  `0030`/`0031`, `analises_processo`): extração de PDF/DOCX/imagem já pronta e testada, e o
  padrão de guardrail `trechoOriginal`/`pagina`/`certeza`/`nao_encontrado` já validado em
  produção. Mas a tabela é modelada 1:1 para **narrativa de processo inteiro**
  (`ficha_caso_id NOT NULL`, 12 seções, write-back em `pessoas_caso`/`eventos_caso`/
  `teses_caso`) — forma errada para "analisar UM documento isolado, que pode nem pertencer a
  uma ficha".
- `app/app/base-conhecimento/actions.ts`: padrão de upload em lote (`FormData` com múltiplos
  arquivos, linha de status por arquivo, processamento sequencial com try/catch por item) —
  referência de UI/action, não de domínio (indexa para RAG, não analisa).

Débito técnico já registrado (`lib/analise-processo/analisar.ts`, comentário da função
`chamarGeminiComSchema`): a lógica de retry/fallback-de-modelo-por-quota já está duplicada
entre `lib/ia/gemini.ts` (chat) e `lib/analise-processo/analisar.ts` (one-shot com
`responseSchema` + parte multimodal). Uma terceira feature (esta) precisando exatamente da
mesma lógica é o gatilho explícito, já antecipado no próprio comentário, para extrair um
helper compartilhado em vez de duplicar pela terceira vez.

`lib/ia/provider.ts#gerarResposta()` (o pool Gemini+Groq) não suporta parte multimodal
(`inlineData`) nem parâmetros de `maxOutputTokens`/`thinkingBudget` por chamada — por isso
`analise-processo` não usa `gerarResposta()` e implementa sua própria chamada direta ao
`GoogleGenAI` client. Essa mesma lacuna se repete para Document Intelligence (também precisa
enviar imagem inline).

## Decisão

### 1. Schema — nova tabela `analises_documento`, não reuso de `analises_processo` nem de `analises_risco_contratual`

```sql
create table analises_documento (
  id                uuid primary key default gen_random_uuid(),
  escritorio_id     uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id     uuid references fichas_caso(id) on delete set null, -- nullable: standalone
  nome_arquivo      varchar(255) not null,
  tipo_arquivo      varchar(10) not null check (tipo_arquivo in ('pdf','docx','imagem')),
  tamanho_bytes     integer not null,
  status            varchar(20) not null default 'processando'
                      check (status in ('processando','pronto','erro')),
  resultado_analise jsonb,              -- estrutura de ResultadoAnaliseDocumento
  modelo_ia_usado   varchar(50),
  erro              text,
  criado_por        uuid references perfis(id) on delete set null,
  criado_em         timestamptz not null default now(),
  processado_em     timestamptz
);
create index idx_analises_documento_escritorio on analises_documento(escritorio_id);
create index idx_analises_documento_ficha on analises_documento(ficha_caso_id);
```

Justificativa de não-reuso:

- **Não é `analises_processo`**: aquela tabela é o resultado de uma narrativa de CASO inteiro
  (12 seções + write-back em `pessoas_caso`/`eventos_caso`/`teses_caso`, `ficha_caso_id NOT
  NULL`). Document Intelligence analisa UM documento isolado (resumo, classificação, cláusulas,
  extração de entidades) sem produzir write-back em entidades de caso — semântica e
  cardinalidade diferentes; forçar reuso exigiria tornar `ficha_caso_id` nullable e adicionar
  um discriminador de "modo" que bifurcaria toda leitura da tabela em dois formatos de JSON
  incompatíveis. Mais barato e mais claro ter uma tabela própria.
- **Não é `analises_risco_contratual`**: é a mais próxima estruturalmente (vereditos por
  cláusula), mas é uma feature real em produção com nav item próprio (`/app/redline`), fluxo
  de "colar texto" (sem upload/extração) e escopo fechado em contratos. Reaproveitar essa
  tabela para uma feature mais ampla (qualquer tipo de documento, upload de arquivo, extração
  de entidades, lote) seria scope creep sobre uma tabela estável já em uso — risco de regressão
  sem ganho real. A análise de cláusulas do redline vira uma SEÇÃO dentro do resultado de
  `analises_documento` (ver item 4), reaproveitando o formato de dado (`veredito`), não a
  tabela.

`ficha_caso_id` nullable segue exatamente o precedente já estabelecido em
`analises_risco_contratual` (migration 0017): documento avulso é o caso comum (due diligence,
triagem de documento recebido antes de abrir ficha), vínculo com ficha é conveniência
opcional.

### 2. Schema — nova tabela `comparacoes_documento` para o comparador A × B

```sql
create table comparacoes_documento (
  id                  uuid primary key default gen_random_uuid(),
  escritorio_id       uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id       uuid references fichas_caso(id) on delete set null,
  nome_arquivo_a      varchar(255) not null,
  nome_arquivo_b      varchar(255) not null,
  -- Link opcional para uma análise individual pré-existente de cada lado (ex: usuário abre a
  -- comparação a partir da tela de uma análise já feita) — nullable porque a comparação
  -- também aceita 2 uploads novos, sem exigir análise individual prévia de cada documento.
  analise_documento_a_id uuid references analises_documento(id) on delete set null,
  analise_documento_b_id uuid references analises_documento(id) on delete set null,
  status              varchar(20) not null default 'processando'
                        check (status in ('processando','pronto','erro')),
  resultado_comparacao jsonb,           -- estrutura de ResultadoComparacaoDocumento
  modelo_ia_usado     varchar(50),
  erro                text,
  criado_por          uuid references perfis(id) on delete set null,
  criado_em           timestamptz not null default now(),
  processado_em       timestamptz
);
create index idx_comparacoes_documento_escritorio on comparacoes_documento(escritorio_id);
```

É uma entidade nova (relaciona 2 documentos, produz 1 diff estruturado) — não cabe como linha
de `analises_documento` (cardinalidade 1 análise = 1 documento, comparação = 2 documentos + 1
diff) nem como duas linhas relacionadas por FK simétrica (adicionaria ambiguidade de "qual é A,
qual é B" resolvida melhor com 2 colunas nomeadas do que com uma tabela de associação
genérica).

### 3. Reaproveitamento concreto

Import direto, sem alteração:
- `lib/analise-processo/extracao.ts` (`extrairTextoDePdfPorPagina`, `extrairTextoDeDocx`,
  `truncarTextoExtraido`, `TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO`) — já é genérico por
  natureza (extrai texto de um arquivo, não sabe nada sobre "processo"). Apesar do nome do
  módulo, a função não depende de `ficha_caso`; reusar em vez de duplicar em
  `lib/document-intelligence/`.

Precisa generalizar antes de reusar (extrair para módulo compartilhado):
- **Chamada estruturada Gemini com retry/fallback de quota + parte multimodal**: hoje vive
  presa dentro de `lib/analise-processo/analisar.ts` (`chamarGeminiComSchema`, privada, não
  exportada). Esta é a 3ª feature que precisa exatamente disso (chat via `gemini.ts`, análise
  de processo, agora Document Intelligence) — vira o gatilho para extrair
  `lib/ia/chamada-estruturada.ts#gerarRespostaEstruturada({ promptTexto, parteExtra,
  systemPrompt, responseSchema, maxOutputTokens, thinkingBudget, cadeiaModelos })`, com a MESMA
  lógica de retry/backoff/fallback-por-quota hoje duplicada. `lib/analise-processo/analisar.ts`
  é refatorado para chamar o helper novo (remove a cópia local) — pagamos o débito técnico já
  sinalizado em vez de criar uma 3ª cópia. `lib/ia/gemini.ts` (usado pelo chat, com histórico
  multi-turno e `contextoRag`) fica fora do escopo desse helper — é deliberadamente para
  chamadas ONE-SHOT (sem histórico), que é o caso de análise de processo, redline e Document
  Intelligence; o chat continua com seu próprio caminho.
- **Estrutura de cláusula do redline**: `ClausulaAnalisada`/`VereditoClausula`
  (`lib/redline/tipos.ts`) não é importada diretamente (é o shape de uma coluna `jsonb` de
  OUTRA tabela, e o redline não faz upload/extração), mas o FORMATO (`veredito` ok/atenção/
  risco_alto, `problema`, `sugestao`) é reaproveitado como o sub-schema `clausulas[]` dentro de
  `ResultadoAnaliseDocumento` (item 4), com os campos de citação (`trechoOriginal`/`pagina`/
  `certeza`) do padrão de Fase 2 adicionados.

Não reaproveitado (fora de escopo por design):
- `base-conhecimento/actions.ts`: só o PADRÃO de action (loop de arquivos, linha de status por
  item) serve de referência de implementação para `analisarDocumentosLoteAction`; o código em
  si indexa para RAG (embeddings/chunking), que não tem relação com Document Intelligence.

### 4. Prompt/schema — `ResultadoAnaliseDocumento` (individual/lote)

Novo módulo `lib/document-intelligence/{prompt,tipos}.ts`, mesmo padrão de
`lib/analise-processo/{prompt,tipos}.ts`:

```ts
type ResultadoAnaliseDocumento = {
  tipoDocumento: string;         // classificação livre: "contrato", "petição", "procuração"...
  resumoExecutivo: string;
  pontosChave: CitacaoDocIntel[] & { descricao: string }[];
  clausulas: (CitacaoDocIntel & { numero: number; veredito: VereditoClausula;
                                   problema: string | null; sugestao: string | null })[];
  entidades: {
    datas: (CitacaoDocIntel & { data: string; descricao: string })[];
    valores: (CitacaoDocIntel & { valor: string; descricao: string })[];
    partes: (CitacaoDocIntel & { nome: string; papel: string })[];
  };
  inconsistencias: (CitacaoDocIntel & { descricao: string })[];
  riscos: (CitacaoDocIntel & { descricao: string; nivel: "baixo"|"medio"|"alto" })[];
  informacoesAusentes: string[]; // sem citação, mesmo padrão da Fase 2
};
```

`CitacaoDocIntel = { trechoOriginal: string; pagina: number | null; certeza:
"confirmado"|"inferido"|"nao_encontrado" }` — é o MESMO tipo `CitacaoAnaliseProcesso` (ADR
0004), reexportado/reaproveitado de `lib/analise-processo/tipos.ts` em vez de redefinido, para
não divergir o contrato de rastreabilidade entre as duas features. `clausulas[]` é opcional
("clausulas": [] quando o documento não tem estrutura clausular, ex.: uma petição) — a IA
decide isso a partir do `tipoDocumento` classificado, sem campo de configuração no formulário.

Mesmo `responseSchema` nativo do Gemini (desliga `tools` automaticamente) + parser Zod
fail-closed (`parsearRespostaAnaliseDocumento`, `safeParse` → `null` em falha, nunca persiste
parcial) + mesmo texto de guarda anti-prompt-injection (documento como DADO delimitado por
`===INÍCIO DO DOCUMENTO===`/`===FIM DO DOCUMENTO===`, nunca instrução).

### 5. Prompt/schema — `ResultadoComparacaoDocumento` (extensão do guardrail para 2 documentos)

```ts
type ClausulaComparada = {
  tipoMudanca: "adicionada" | "removida" | "alterada" | "inalterada_relevante";
  trechoA: string | null; paginaA: number | null;   // null quando "adicionada" (não existe em A)
  trechoB: string | null; paginaB: number | null;   // null quando "removida" (não existe em B)
  certeza: "confirmado" | "inferido" | "nao_encontrado";
  resumoMudanca: string;
  risco: "baixo" | "medio" | "alto" | null;          // null quando a mudança não implica risco
};

type ResultadoComparacaoDocumento = {
  resumoGeral: string;
  clausulas: ClausulaComparada[];
  riscosIntroduzidos: (ClausulaComparada & { descricao: string })[]; // subconjunto de risco alto/médio
  recomendacoes: string[]; // sem citação — mesmo papel de "informacoesAusentes"/"próximasAcoes"
};
```

Extensão do padrão de citação de 1 documento para 2: em vez de um único
`trechoOriginal`/`pagina`, cada item carrega um PAR (`trechoA`/`paginaA`,
`trechoB`/`paginaB`), com a regra explícita no `zod .refine()`:
- `tipoMudanca: "adicionada"` exige `trechoA: null` e `trechoB` preenchido;
- `tipoMudanca: "removida"` exige `trechoB: null` e `trechoA` preenchido;
- `tipoMudanca: "alterada"` ou `"inalterada_relevante"` exige AMBOS preenchidos (é impossível
  comparar uma mudança sem o trecho dos dois lados);
- `certeza: "nao_encontrado"` só é aceitável quando a IA identifica uma referência a algo
  ("existe uma cláusula sobre X em algum lugar") mas não consegue localizar o trecho exato —
  fail-closed igual à Fase 2 (rejeitado se vier sem justificativa).

Prompt delimita os dois documentos com marcadores distintos (`===INÍCIO DOCUMENTO
A===...===FIM DOCUMENTO A===`, mesmo para B) e instrução explícita de que AMBOS os blocos são
DADO, nunca instrução — dobra a superfície de prompt-injection (2 documentos de terceiros em
vez de 1), então o texto de guarda é reforçado citando os dois marcadores nominalmente.

### 6. UI — nova seção standalone "Documentos", com entrada opcional a partir da ficha

Novo nav item `/app/documentos` (ao lado de "Redline" na sidebar), não uma aba dentro de
`/app/fichas/[id]`, porque nem todo documento a analisar pertence a uma ficha aberta (mesmo
argumento já usado para `analises_risco_contratual.ficha_caso_id` nullable) — forçar o fluxo
a nascer de dentro de uma ficha específica excluiria o caso de uso "recebi um documento de um
cliente em potencial, quero entender antes de abrir ficha".

Estrutura da seção:
- `/app/documentos` — lista de análises (`analises_documento`) do escritório, com filtro por
  status/tipo, botão "Analisar documento" (individual) e "Analisar em lote".
- `/app/documentos/novo` — formulário de upload individual; aceita `?fichaId=` na query string
  para pré-vincular quando aberto a partir do botão "Analisar documento" dentro de
  `/app/fichas/[id]` (ficha ganha um botão de atalho, não uma aba nova — evita sobrecarregar a
  página da ficha, que já tem a aba de Fase 2).
- `/app/documentos/lote` — upload múltiplo (`<input type="file" multiple>`), mesmo padrão
  visual de `upload-documento-form.tsx` da base de conhecimento, processamento sequencial
  (item 8).
- `/app/documentos/[id]` — resultado de uma análise individual (badges de `certeza`, clique
  abre `trechoOriginal`/`pagina`), com botão "Comparar com outro documento" que leva a
  `/app/documentos/comparar?a=[id]`.
- `/app/documentos/comparar` — formulário de comparação (documento A já selecionado via query
  ou upload novo dos dois lados) + resultado do diff.

Redline permanece como está nesta ADR (sem migração de nav/tabela) — consolidar
"análise de risco contratual" dentro de "Documentos" é uma mudança de produto maior (fundir
duas telas já em uso), registrada como alternativa considerada e não decidida agora (item
"Alternativas consideradas").

### 7. Gating — 2 features Pro novas, batch sem limite adicional no Free (Free não tem acesso)

`lib/planos/gating.ts`, `FEATURES_PREMIUM` ganha 2 chaves (não reusa
`analise_inteligente_processo`, que é a feature de Fase 2):

- `analise_documento` — análise individual E em lote (mesma chave; lote é a mesma operação
  repetida N vezes, não uma feature de precificação distinta). Pro-only, sem tier gratuito
  parcial — mesmo padrão de `analise_risco_contratual`/`analise_inteligente_processo`: as 3
  features que consomem o pool de IA para análise estruturada de documento são todas
  integralmente Pro, para consistência de posicionamento comercial (não faz sentido dar
  análise individual de graça e cobrar só o lote, ou vice-versa).
- `comparacao_documentos` — Pro-only, chave separada (não reusa `analise_documento`) porque é
  operacionalmente mais cara (2x extração + prompt maior) e a separação permite no futuro
  aplicar um limite de uso diferenciado (ex.: N comparações/mês) sem tocar no gate de análise
  individual — mesmo racional de granularidade já estabelecido no ADR 0001 (7 chaves
  independentes, cada uma barata de auditar).

Limite de lote: `MAX_ARQUIVOS_LOTE_DOCUMENTO = 15` — cap técnico fixo (não por plano),
justificado por processamento sequencial síncrono dentro do teto de `maxDuration` da Vercel
(mesmo racional do teto de 300k caracteres da Fase 2): acima disso, pedir para dividir em mais
de um lote. Aplica-se igualmente a todo escritório Pro; não é uma dimensão de gating adicional.

### 8. Processamento do lote — sequencial, mesma Server Action, sem fila

Sem introduzir fila/job (mesmo racional do ADR 0004 item 6: não há infraestrutura de fila hoje,
volume esperado não justifica). `analisarDocumentosLoteAction` recebe `FormData` com N
arquivos, cria N linhas `analises_documento` com `status: "processando"` ANTES de qualquer
chamada de IA (mesmo padrão do upload individual da Fase 2), processa os arquivos em loop
sequencial (não `Promise.all` — evita estourar concorrência do pool de chaves Gemini/Groq e
o teto de `maxDuration` de forma imprevisível), atualiza status por item conforme cada um
termina. `export const maxDuration = 300` no segmento de rota (teto mais alto que os 120s da
Fase 2, pois lote pode ter até 15 arquivos) — se isso se mostrar insuficiente na prática
(usuário realista sempre no teto do lote), é o gatilho para um ADR futuro de processamento
assíncrono real, não resolvido preventivamente aqui.

## Consequências

**Positivas**

- Zero duplicação de extração de texto (reaproveita `lib/analise-processo/extracao.ts` 100%).
- Paga o débito técnico já sinalizado: retry/fallback de quota fica em UM lugar
  (`lib/ia/chamada-estruturada.ts`) em vez de uma 3ª cópia.
- Guardrail de citação (`trechoOriginal`/`pagina`/`certeza`) mantém o MESMO shape entre Fase 2
  e Fase 3 (tipo reaproveitado, não redefinido), reduzindo risco de UIs de citação divergentes.
- Redline continua estável (nenhuma migração de tabela/nav em produção) enquanto Document
  Intelligence nasce com escopo mais amplo (qualquer tipo de documento, upload, extração de
  entidades, lote, comparação).
- Comparação com par de citações (`trechoA`/`trechoB`) é auditável sem exigir carregar os dois
  documentos originais de novo na tela de resultado.

**Negativas**

- Duas tabelas novas (`analises_documento`, `comparacoes_documento`) além das já existentes
  (`analises_processo`, `analises_risco_contratual`) — 4 tabelas de "resultado de análise de
  IA sobre documento" no total, com sobreposição conceitual que só é resolvida por
  documentação/ADR, não pelo schema em si (uma consulta "todas as análises de IA feitas sobre
  documentos deste escritório" hoje exigiria UNION de até 4 tabelas). Aceito por ora; se essa
  consulta se tornar um requisito de produto real (ex.: dashboard consolidado), é gatilho para
  um ADR de unificação/view materializada.
- Refatorar `lib/analise-processo/analisar.ts` para usar o helper novo é um risco de regressão
  em código já em produção (Fase 2) — precisa de teste de regressão explícito na Onda 3.
- Lote sequencial de até 15 arquivos pode levar minutos — UI precisa comunicar isso
  claramente (mesma limitação de UX de espera longa já aceita no ADR 0004).
- Sem tier gratuito parcial: usuário Free não pode nem experimentar análise individual de 1
  documento — decisão comercial, não técnica; se o produto quiser oferecer 1 análise grátis
  como isca, é mudança de gating simples (override por escritório já suportado), não requer
  nova migration.

## Alternativas consideradas

1. **Generalizar `analises_processo` para aceitar `ficha_caso_id` nullable e um discriminador
   de modo ("processo" vs "documento")** — rejeitada: bifurcaria o formato do `jsonb` em dois
   shapes incompatíveis dentro da mesma coluna, complicando toda leitura/validação e write-back
   já implementados na Fase 2 sem necessidade real (nenhuma consulta hoje precisa tratar as
   duas coisas como a mesma entidade).
2. **Fundir Redline dentro de Document Intelligence agora** (cláusulas viram uma feature de
   `analises_documento`, tabela e nav do redline são descontinuadas) — mais limpo
   conceitualmente a longo prazo, mas exige migrar dados/UI de uma feature já em produção
   dentro do mesmo ADR que introduz duas tabelas novas — risco desnecessário. Registrado como
   direção futura, não decidido agora.
3. **Comparação como duas linhas de `analises_documento` ligadas por uma tabela de associação
   genérica (`documento_comparacoes: { analise_a_id, analise_b_id }`) sem coluna de resultado
   própria** — mais "normalizado", mas o resultado do diff não pertence a nenhum dos dois
   documentos isoladamente (é uma terceira entidade); ter `resultado_comparacao` numa tabela de
   associação pura ficaria estranho semanticamente. Rejeitada.
4. **Lote com fila/job assíncrono (Supabase Edge Function ou similar) desde já** — mesma
   rejeição do ADR 0004 item 6: sem volume que justifique a complexidade operacional agora;
   fica como gatilho de ADR futuro se o teto de `maxDuration` se mostrar insuficiente na
   prática.
5. **`analise_documento` e `comparacao_documentos` como UMA única chave de gating** — mais
   simples, mas remove a opção futura de precificar/limitar comparação separadamente sem nova
   migration; o custo de manter 2 chaves hoje é desprezível (mesmo padrão já usado com 7 chaves
   independentes no ADR 0001).

## Plano de implementação (ondas)

**Onda 0 — `database`** (sequencial, bloqueia as demais):
- `supabase/migrations/0033_analises_documento.sql` (tabela + índices + RLS).
- `supabase/migrations/0034_comparacoes_documento.sql` (tabela + índices + RLS).
- `lib/types.ts`: tipos `AnaliseDocumento`, `ComparacaoDocumento` (apontando para
  `ResultadoAnaliseDocumento`/`ResultadoComparacaoDocumento` em
  `lib/document-intelligence/tipos.ts`, mesmo padrão de `AnaliseProcesso`).
- `lib/planos/gating.ts`: novas features `analise_documento` e `comparacao_documentos` em
  `FEATURES_PREMIUM`.

**Onda 1 — `ai-engineer`** (paralelo entre si, depende só da Onda 0):
- `lib/ia/chamada-estruturada.ts`: extrai `gerarRespostaEstruturada(...)` de
  `lib/analise-processo/analisar.ts#chamarGeminiComSchema` (retry/backoff/fallback de quota +
  parte multimodal opcional), reutilizável.
- `lib/analise-processo/analisar.ts`: refatorado para chamar o helper novo (remove a cópia
  local) — sem mudança de comportamento observável.
- `lib/document-intelligence/tipos.ts`: `ResultadoAnaliseDocumento`, `ClausulaComparada`,
  `ResultadoComparacaoDocumento` (reaproveitando `CitacaoAnaliseProcesso` de
  `lib/analise-processo/tipos.ts`).
- `lib/document-intelligence/prompt.ts`: system prompt + `RESPONSE_SCHEMA` + parser Zod
  fail-closed da análise individual.
- `lib/document-intelligence/prompt-comparacao.ts`: system prompt + `RESPONSE_SCHEMA` + parser
  Zod fail-closed (com `.refine()` de coerência `tipoMudanca`↔`trechoA`/`trechoB`) da
  comparação.
- `lib/document-intelligence/analisar.ts`: função principal (dispatch por `tipoArquivo`,
  chama `gerarRespostaEstruturada`, parse fail-closed) — espelha
  `lib/analise-processo/analisar.ts#analisarDocumentoProcesso`.
- `lib/document-intelligence/comparar.ts`: função principal da comparação (extrai texto dos 2
  documentos, monta prompt com 2 marcadores, chama IA, parse fail-closed).

**Onda 2 — `senior-engineer`** (depende da Onda 1):
- `app/app/documentos/actions.ts`: `analisarDocumentoAction` (individual),
  `analisarDocumentosLoteAction` (lote sequencial, `MAX_ARQUIVOS_LOTE_DOCUMENTO = 15`),
  `compararDocumentosAction` — cada uma com gate de plano ANTES de qualquer I/O.
- `export const maxDuration = 120` (individual/comparação) e `= 300` (lote) nos segmentos de
  rota correspondentes.
- `components/app/documento-upload-form.tsx`, `components/app/documento-lote-form.tsx`,
  `components/app/documento-resultado.tsx` (badges de `certeza`, clique abre citação),
  `components/app/comparacao-form.tsx`, `components/app/comparacao-resultado.tsx` (diff visual
  lado a lado A/B).
- `app/app/documentos/page.tsx`, `app/app/documentos/novo/page.tsx`,
  `app/app/documentos/lote/page.tsx`, `app/app/documentos/[id]/page.tsx`,
  `app/app/documentos/comparar/page.tsx`.
- `components/app/sidebar.tsx`: novo item de navegação "Documentos".
- `app/app/fichas/[id]/page.tsx`: botão de atalho "Analisar documento" linkando para
  `/app/documentos/novo?fichaId=[id]`.

**Onda 3 — revisão** (paralelo): `security` (upload de arquivo arbitrário, prompt injection em
2 documentos simultâneos na comparação, RLS das 2 tabelas novas) + `qa` (casos: PDF/DOCX/
imagem individual, lote com arquivo inválido no meio, comparação com documentos de tamanhos
muito diferentes, resposta fora do schema, regressão de `analise-processo/analisar.ts` após a
extração do helper) + `techlead`.

## Arquivos lidos para este design

`docs/adrs/0004-analise-inteligente-processos.md`, `lib/redline/tipos.ts`,
`lib/redline/prompt.ts`, `app/app/redline/actions.ts`, `lib/analise-processo/extracao.ts`,
`lib/analise-processo/analisar.ts`, `lib/analise-processo/tipos.ts`,
`app/app/base-conhecimento/actions.ts`, `lib/ia/provider.ts`, `lib/planos/gating.ts`,
`components/app/sidebar.tsx`, `supabase/migrations/0017_analises_risco_contratual.sql`,
listagem de `supabase/migrations/*.sql`, `lib/types.ts` (trecho `AnaliseProcesso`).
