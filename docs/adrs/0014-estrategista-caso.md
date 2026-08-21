# 0014 — Estrategista Jurídico (Fase 6)

## Status

Proposto (2026-08-21)

## Contexto

Ciclo 1 (Fases 0-5) cobre Auditoria/Caso Inteligente/Análise de Processos/Document Intelligence/
Auditor de Peças (ADR 0012)/Advogado do Contra (ADR 0013). Todas as 5 features de IA estruturada
até aqui são **one-shot sobre um texto avulso**: o usuário cola ou envia um documento isolado, a
IA analisa aquele texto sozinho, o resultado nasce numa tabela nova (`auditorias_peca`,
`analises_advogado_contra`, `analises_documento`, `analises_risco_contratual`,
`analises_processo`). A Fase 6 pede algo estruturalmente diferente: **não há texto novo do
usuário** — o Estrategista Jurídico sintetiza tudo que já existe sobre um caso (`fichas_caso`) já
aberto, produzindo objetivo, tese principal, teses subsidiárias, provas necessárias/disponíveis,
riscos, oportunidades, próximos passos e ações recomendadas, com um fluxo de confirmação que
transforma recomendação em tarefa real (`tarefas_caso`).

Fontes de contexto já existentes que o Estrategista precisa ler, todas amarradas a
`fichas_caso.id`:

- `fichas_caso` — dados-base (`resumo_fatos`, `area_direito`, `urgencia`) mais os campos LEGADOS
  `resumo_ia`/`questoes_ia`/`estrategia_ia`, escritos por `gerarAnaliseIaAction`
  (`app/app/fichas/actions.ts`) via parsing de marcador de string (`===RESUMO===`/
  `===QUESTOES===`/`===ESTRATEGIA===`), não `gerarRespostaEstruturada`/Zod. É o pipeline mais
  antigo do produto — anterior ao padrão de `RESPONSE_SCHEMA` nativo usado desde a Fase 2 — mas
  ainda ativo (usado por classificação de risco e indexação RAG) e é a ÚNICA fonte hoje que já
  escreve em `teses_caso` a partir de texto livre de IA (`montarTeseCasoDaAnaliseIa`).
- `teses_caso` (migration `0025`) — já modela tese + fundamentação + status
  (`em_avaliacao`/`adotada`/`descartada`) + histórico append-only. Duas fontes já escrevem aqui:
  `gerarAnaliseIaAction` (write-back do pipeline legado) e o write-back de `analises_processo`
  (`montarTeseCasoDaAnaliseProcesso`, ADR 0004). `lib/casos/teses.ts` expõe os helpers puros de
  montagem (`montarNovaTeseCaso`, `montarAtualizacaoStatusTese`).
- `tarefas_caso` (migration `0027`) — checklist operacional do caso, distinto de `prazos`.
  `criarTarefaCasoAction` (`app/app/fichas/[id]/tarefas-actions.ts`) já existe e é a ÚNICA porta
  de escrita usada pela UI da ficha.
- `eventos_caso` (migration `0024`, também referida no pedido original como "linha do tempo") —
  histórico append-only de eventos do caso (manual/IA/DJEN/documento).
- `pessoas_caso` (migration `0023`) — partes/testemunhas/terceiros do caso.
- `caso_jurisprudencia_citada` (migration `0026`) — junção com a tabela pública `jurisprudencias`.
- `analises_processo`/`analises_documento` — quando existem linhas para o mesmo `ficha_caso_id`,
  já carregam resumo/riscos/teses/questões extraídos por IA de documentos do caso.

Nenhuma feature anterior lê **múltiplas tabelas relacionais + jsonb de outras análises de IA**
como entrada — todas leem um único texto (colado ou extraído de upload). O Estrategista é o
primeiro "agregador" do produto, não um "analisador de texto avulso" — essa diferença estrutural
orienta a maior parte das decisões novas deste ADR.

## Decisão

### 1. Schema de armazenamento — nova tabela `estrategias_caso`, um snapshot versionado por geração, nunca um registro único sobrescrito

```sql
create table estrategias_caso (
  id                    uuid primary key default gen_random_uuid(),
  escritorio_id         uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id         uuid not null references fichas_caso(id) on delete cascade, -- NUNCA nullable (ver seção 6)
  status                varchar(20) not null default 'processando'
                          check (status in ('processando', 'pronto', 'erro')),
  resultado_estrategia  jsonb,             -- estrutura de ResultadoEstrategiaCaso
  contexto_resumo       jsonb,             -- snapshot do QUE foi lido para gerar (ver seção 4)
  modelo_ia_usado       varchar(50),
  erro                  text,
  criado_por            uuid references perfis(id) on delete set null,
  criado_em             timestamptz not null default now(),
  processado_em         timestamptz
);
create index idx_estrategias_caso_escritorio on estrategias_caso(escritorio_id);
create index idx_estrategias_caso_ficha_criado on estrategias_caso(ficha_caso_id, criado_em desc);

alter table estrategias_caso enable row level security;
create policy "estrategias_caso_isolamento" on estrategias_caso
  for all using (escritorio_id = escritorio_atual());
```

Mesmo racional já estabelecido em `analises_documento`/`auditorias_peca`/
`analises_advogado_contra`: cada geração é uma linha nova, nunca um UPDATE de uma linha
"corrente" — mas aqui a justificativa é mais forte que nas features anteriores, porque a ENTRADA
muda com o tempo por natureza (uma nova tese é adotada, uma prova é juntada, um prazo vence, um
documento é analisado) enquanto nas features 4/5 a entrada (o texto colado/upload) é imutável
por definição depois de submetida. Sobrescrever "a estratégia atual" perderia a trilha de "o que
a IA recomendou quando o caso estava num estado anterior" — dado relevante para auditoria (ex.:
"por que decidimos não seguir a tese X em março, se ela aparece como oportunidade agora em
agosto?"). `contexto_resumo` (jsonb leve: ids/contadores das fontes lidas — quantas teses,
quantos eventos, ids de análises de documento consideradas, não o conteúdo integral) permite à UI
mostrar "gerado com base em: 3 teses, 12 eventos, 2 análises de documento" sem re-consultar todas
as tabelas de origem, e sinaliza ao advogado quando uma estratégia antiga pode estar desatualizada
(comparando `contexto_resumo.contagens` da versão mais recente contra o estado atual das tabelas
de origem — heurística simples de "furou o snapshot", não obrigatória para o MVP desta fase, mas
o campo já nasce pronto para isso sem migração futura).

`ficha_caso_id` **não é nullable** — única tabela de resultado de IA do projeto com essa
obrigatoriedade (todas as 5 anteriores usam `nullable` para permitir uso standalone). Justificado
na seção 6: o Estrategista não faz sentido sem um caso já aberto.

Nome da coluna de resultado (`resultado_estrategia`) segue o padrão de nome próprio por tabela já
estabelecido (`resultado_analise`, `resultado_auditoria`, `resultado_advogado_contra`) — nunca um
nome genérico reutilizável entre tabelas.

### 2. Teses — REFERÊNCIA a `teses_caso` existentes por padrão, com fallback de texto livre só quando não há tese cadastrada equivalente

A tese principal e as subsidiárias do resultado **não duplicam** o texto de uma tese já
cadastrada em `teses_caso` quando ela existe — apontam para lá por id:

```ts
export type TeseEstrategiaCaso =
  | { origem: "tese_cadastrada"; teseCasoId: string; papel: "principal" | "subsidiaria" }
  | { origem: "sugerida"; papel: "principal" | "subsidiaria"; tese: string; fundamentacao: string };
```

Justificativa de não sempre-referenciar (por que `sugerida` existe): o caso pode não ter NENHUMA
tese cadastrada ainda (`teses_caso` vazia é um estado válido, principalmente em casos recém-
abertos), e o Estrategista precisa poder propor uma tese principal do zero nesse cenário — forçar
sempre uma referência exigiria criar a tese em `teses_caso` como efeito colateral de uma
GERAÇÃO de análise (leitura), o que quebraria o padrão fail-closed do projeto (gerar sempre grava
o mesmo shape, nunca decide sozinho popular outra tabela). Quando `origem: "sugerida"`, a UI expõe
um botão "Cadastrar como tese do caso" que chama `criarTeseManualAction` já existente (mesmo
padrão de "confirmar recomendação" da seção 3, reaproveitando ação já existente em vez de criar
uma nova rota de escrita).

Justificativa de preferir `tese_cadastrada` quando aplicável: `teses_caso` já é a fonte de
verdade de "quais teses este caso está considerando", com histórico de adoção/descarte auditável
(`historico` append-only). Duplicar o texto de uma tese já adotada dentro do jsonb de
`estrategias_caso` criaria uma segunda cópia que diverge silenciosamente se o advogado editar a
tese original depois — o Estrategista deve sempre reconciliar com o dado vivo (join em tela, não
join de dado congelado) sempre que uma tese cadastrada já cobrir o que a IA quer recomendar.

O prompt instrui a IA a **primeiro tentar casar** sua recomendação com uma tese já existente
(lista de `teses_caso.tese` enviada como contexto, com seus ids) e só cair em `sugerida` quando
nenhuma tese cadastrada for semanticamente equivalente — decisão de produto e não só de schema,
registrada aqui porque motiva o formato da união acima.

### 3. Schema do resultado — `ResultadoEstrategiaCaso`, com "próximo passo" desenhado para conversão 1:1 em `tarefas_caso`

Novo módulo `lib/estrategia-caso/tipos.ts`:

```ts
export const CATEGORIAS_RISCO_ESTRATEGIA = [
  "prazo", "prova", "jurisprudencia", "fundamentacao", "processual", "financeiro", "reputacional",
] as const;
export type CategoriaRiscoEstrategia = (typeof CATEGORIAS_RISCO_ESTRATEGIA)[number];

export const NIVEIS_RISCO_ESTRATEGIA = ["baixo", "medio", "alto"] as const;
export type NivelRiscoEstrategia = (typeof NIVEIS_RISCO_ESTRATEGIA)[number];

/** Origem da recomendação — rastreabilidade LEVE, não citação literal (ver
 * discussão de `CitacaoAnaliseProcesso` abaixo). */
export type OrigemContextoEstrategia =
  | { tipo: "tese"; teseCasoId: string }
  | { tipo: "evento"; eventoCasoId: string }
  | { tipo: "analise_documento"; analiseDocumentoId: string }
  | { tipo: "analise_processo"; analiseProcessoId: string }
  | { tipo: "ficha" }; // fatos-base da própria ficha, sem id de fonte adicional

export type RiscoEstrategiaCaso = {
  categoria: CategoriaRiscoEstrategia;
  nivel: NivelRiscoEstrategia;
  descricao: string;
  origem: OrigemContextoEstrategia[];
};

export type OportunidadeEstrategiaCaso = {
  descricao: string;
  origem: OrigemContextoEstrategia[];
};

export type ProvaEstrategiaCaso = {
  descricao: string;
  status: "disponivel" | "necessaria";
  /** Só relevante quando `status === "disponivel"` — aponta pra onde a prova já foi
   * identificada (ex.: evento da linha do tempo, análise de documento). */
  origem: OrigemContextoEstrategia[];
};

/** Desenhado para virar 1 tarefa em `tarefas_caso` com um clique — o shape
 * espelha `NovaTarefaCasoFormInput` (`lib/casos/tarefas.ts`) de propósito:
 * `titulo` -> `titulo`, `prazoSugerido` -> `prazoOpcional`. */
export type ProximoPassoEstrategiaCaso = {
  titulo: string;
  detalhe: string | null;
  prazoSugerido: string | null; // YYYY-MM-DD, estimativa relativa da IA — nunca prazo processual formal
  prioridade: "baixa" | "media" | "alta";
  origem: OrigemContextoEstrategia[];
};

/** "Ações recomendadas" — mesma finalidade prática de "próximo passo" (também
 * conversível em tarefa), mas de natureza estratégica/estrutural em vez de
 * operacional (ex.: "considerar acordo" vs. "solicitar comprovante de residência
 * atualizado"). Categorias distintas de produto, mesmo shape de conversão. */
export type AcaoRecomendadaEstrategiaCaso = ProximoPassoEstrategiaCaso;

export type ResultadoEstrategiaCaso = {
  objetivo: string;
  teses: TeseEstrategiaCaso[]; // 1 principal + N subsidiárias (papel discrimina)
  provas: ProvaEstrategiaCaso[];
  riscos: RiscoEstrategiaCaso[];
  oportunidades: OportunidadeEstrategiaCaso[];
  proximosPassos: ProximoPassoEstrategiaCaso[];
  acoesRecomendadas: AcaoRecomendadaEstrategiaCaso[];
  ressalvas: string[]; // lacunas de contexto que limitam a confiança da estratégia (ver seção 4)
};
```

**Decisão deliberada de NÃO reaproveitar `CitacaoAnaliseProcesso`** (`trechoOriginal`/`pagina`/
`certeza`), quebrando o padrão que as 4 features anteriores (Fase 2, Document Intelligence,
Auditor de Peças, Advogado do Contra) compartilham. Motivo: `CitacaoAnaliseProcesso` modela
rastreabilidade até um TRECHO LITERAL de UM documento/texto único — faz sentido quando a entrada
é um texto contínuo com páginas. Aqui a entrada é a AGREGAÇÃO de várias fontes estruturadas
distintas (uma tese, um evento, uma análise inteira) — "de onde veio" é melhor modelado como
referência a uma LINHA de outra tabela (`OrigemContextoEstrategia`, união discriminada por id) do
que como um trecho de texto com número de página, que não existe nesse domínio. Forçar
`trechoOriginal: string`/`pagina: number | null` aqui produziria campos artificiais
(`trechoOriginal` teria que ser um resumo inventado da fonte, não um trecho literal copiado) —
pior guardrail, não melhor. `origem` é sempre um ARRAY (não union singular) porque uma
recomendação pode nascer da combinação de múltiplas fontes (ex.: um risco de prazo que cruza um
evento da linha do tempo com uma tese adotada).

`ressalvas: string[]` é o equivalente desta feature ao `informacoesAusentes`/`omissoesDetectadas`
das features anteriores: lacunas de contexto (ex.: "não há documentos anexados analisados para
este caso — a estratégia considera apenas os fatos relatados na ficha e as teses já cadastradas")
— campo obrigatório no schema (pode ser array vazio, mas o campo sempre existe), reforçando a
mesma humildade epistêmica já exigida no Auditor de Peças (ADR 0012, seção 4, item 2), agora
aplicada a "quão completo era o contexto disponível" em vez de "quão extremo é um número".

`prazoSugerido` é explicitamente uma ESTIMATIVA da IA (nunca gravado como prazo processual formal
em `prazos` — essa tabela tem regra de dobra do CPC e side-effects de agenda que não cabem aqui);
vira `prazoOpcional` em `tarefas_caso` (que já é um campo `date` sem regra de dobra), nunca em
`prazos`.

### 4. Contexto enviado à IA — teto de tamanho + priorização por relevância recente, seguindo o racional de `TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO`

Diferente das 5 features anteriores (1 texto ~ 1 chamada), aqui o contexto é a SOMA de várias
fontes. Proposta de teto agregado: `TAMANHO_MAXIMO_CONTEXTO_ESTRATEGIA = 120_000` caracteres
(entre o teto de peça avulsa do Auditor — 60k — e o teto de documento extraído — 300k — porque a
entrada aqui é estruturada/pré-resumida por natureza, não texto bruto de página de PDF, então
deveria caber com folga na prática mesmo em casos com histórico extenso).

Ordem de prioridade de montagem do prompt até o teto (mais barato/essencial primeiro, corta o
resto quando o teto é atingido — mesmo espírito de `truncarTextoExtraido`, mas por SEÇÃO inteira,
nunca cortando uma tese ou um evento no meio):

1. `fichas_caso` (resumo_fatos, area_direito, urgencia, status_processual) — sempre incluído
   por completo, é o núcleo do caso e é curto por natureza.
2. `teses_caso` — todas as linhas (tese + fundamentação + status), ordenadas por `atualizado_em`
   desc; é o dado mais estruturado e mais barato de processar.
3. `eventos_caso` — últimos N eventos por `data_evento` desc (ex.: 30, configurável), não a
   linha do tempo inteira de um caso de anos — eventos antigos pesam menos na estratégia atual
   que os recentes, e um caso longevo pode ter centenas de eventos.
4. `pessoas_caso` — todas as linhas (volume tipicamente baixo, poucas dezenas no máximo).
5. `caso_jurisprudencia_citada` (join com `jurisprudencias` para o texto da ementa/resumo) —
   todas as linhas.
6. Resumos (não o jsonb inteiro) de `analises_processo`/`analises_documento` mais recentes
   vinculadas à mesma ficha — só os campos `resumoExecutivo`/equivalente e `riscos`/`tesesPossiveis`
   já extraídos, NUNCA reprocessando o documento original do zero (ver justificativa abaixo). Se
   houver muitas análises, prioriza as mais recentes até o teto.
7. Campos legados `resumo_ia`/`questoes_ia`/`estrategia_ia` de `fichas_caso` **só como contexto
   de fallback de baixa prioridade** (última seção, cortada primeiro se faltar espaço) — não
   como fonte primária. Justificativa da seção "O que decidir" item 1: o pipeline legado
   (`gerarAnaliseIaAction`) não é substituído nem descontinuado por esta fase (fora de escopo
   migrar um pipeline estável em produção só porque uma feature nova poderia fazer melhor), mas
   também não deveria ganhar peso maior que dado estruturado mais recente e mais confiável
   (`teses_caso`, análises já estruturadas) — é tratado como "mais um sinal de baixa prioridade",
   não como substituto nem como insumo obrigatório.

**Reler resumos já extraídos de `analises_documento`/`analises_processo` em vez de reprocessar
documentos do zero** (decisão da seção "O que decidir" item 4-adjacente): o custo de reabrir e
re-extrair texto de N documentos do processo por chamada de Estrategista seria proporcional ao
número de documentos do caso E duplicaria uma extração já paga e já persistida; o resumo
estruturado já existente é a "citação de segunda ordem" correta aqui — mesmo espírito de RAG
citando um resumo em vez de reindexar do zero. Trade-off aceito: se um documento nunca foi
analisado por Document Intelligence/Análise de Processo, seu conteúdo simplesmente não aparece
como contexto — comunicado ao usuário via `ressalvas` (seção 3) quando a IA perceber que a ficha
tem poucos/nenhum documento analisado, nunca escondido silenciosamente.

Sem upload/extração nesta feature — zero reuso de `lib/analise-processo/extracao.ts` (não há
arquivo novo a extrair, a leitura é 100% de linhas de banco já estruturadas).

### 5. Fluxo "confirmar recomendação → criar tarefa" — UI pura sobre a action já existente, sem geração de IA nova

`components/app/estrategia-caso-resultado.tsx` renderiza cada item de `proximosPassos` e
`acoesRecomendadas` com um checkbox (ou botão "Criar tarefa") que, ao ser confirmado, chama
`criarTarefaCasoAction(fichaCasoId, { titulo, prazoOpcional: prazoSugerido, responsavelPerfilId: null })`
— **sem nenhuma action nova**, reuso direto de `app/app/fichas/[id]/tarefas-actions.ts`. Depois de
criada, o item entra num estado local "tarefa criada" (desabilitado, com link para a tarefa) —
não há coluna nova em `estrategias_caso` marcando "este item virou tarefa": o jsonb de resultado é
imutável (é um snapshot histórico, seção 1), e o vínculo "quais itens já viraram tarefa" é
efêmero/de UI, resolvido client-side comparando título+origem contra `tarefas_caso` já listadas
para a ficha (mesma query que `listarTarefasCasoAction` já expõe) — evita nova coluna de estado
mutável numa tabela desenhada para ser append-only de histórico.

Idempotência: como não há id determinístico ligando "item da estratégia" a "tarefa criada", o
usuário pode clicar duas vezes e criar duas tarefas iguais — aceito como risco baixo (mesma
classe de risco de qualquer form sem dedupe no projeto), mitigado por desabilitar o botão
imediatamente após o primeiro clique bem-sucedido (otimista, client-side), não bloqueante para
esta fase.

### 6. UI — EMBUTIDO em `/app/fichas/[id]`, não uma rota standalone — divergência deliberada do padrão Auditor/Advogado do Contra

Diferente do Auditor de Peças (ADR 0012) e do Advogado do Contra (ADR 0013), que são
standalone-first (podem rodar sem nenhuma ficha aberta, com vínculo opcional via `?fichaId=`), o
Estrategista **sempre** precisa de uma ficha — não existe "estratégia sem caso". Consequências
diretas dessa diferença:

- `ficha_caso_id` não-nullable (seção 1), única tabela de resultado de IA do projeto assim.
- **Sem nova rota `/app/estrategia`** (nem lista, nem formulário próprio). A geração é um botão
  "Gerar estratégia" dentro de `/app/fichas/[id]`, ao lado dos atalhos já existentes "Auditar
  peça" e "Testar tese contra" — mas, diferente desses dois (que NAVEGAM para
  `/app/auditor/novo?fichaId=`/`/app/advogado-contra/novo?fichaId=`), o botão do Estrategista
  dispara a geração INLINE (Server Action chamada da própria página da ficha) e o resultado é
  renderizado numa seção/aba própria da MESMA página (`components/app/estrategia-caso-resultado.tsx`,
  aba "Estratégia" ao lado das abas já existentes de Teses/Tarefas/Linha do tempo/Documentos),
  não uma navegação para fora.
- Justificativa central: as 5 features anteriores produzem um artefato que FAZ SENTIDO como
  entidade autônoma navegável e listável fora de qualquer ficha (uma auditoria de peça pode ser
  gerada antes de decidir abrir caso; uma tese testada pode vir de uma minuta avulsa). O
  Estrategista não tem equivalente: cada estratégia SÓ existe em função de um caso já aberto e
  com dados já carregados nas tabelas da seção "O que decidir" — não há cenário de produto em
  que o advogado queira "gerar uma estratégia" sem ter uma ficha na tela. Criar uma rota
  standalone replicaria a UX de lista das 5 features anteriores para um recurso que 100% das
  vezes será acessado a partir de dentro de uma ficha específica, adicionando uma tela de
  navegação sem função real (o usuário nunca chegaria lá "de fora").
  - Histórico de versões (seção 1) é resolvido como uma lista dentro da própria aba "Estratégia"
    da ficha (mais recente expandida, anteriores colapsadas com timestamp), não como uma listagem
    de tabela cross-caso — não há necessidade de produto de "ver todas as estratégias de todos os
    casos do escritório numa tela só" hoje; se isso emergir como requisito real, é gatilho para um
    ADR de "central de estratégias" análogo à possibilidade já registrada no ADR 0012 (seção 5,
    alternativa 2) para consolidação de análises.
- Nav item da sidebar: **nenhum item novo**. Diferente das 5 features anteriores, todas com item
  próprio (`Auditor`, `Advogado do Contra`, `Redline`, `Documentos`), porque não há uma "lista
  global" para linkar — a única entrada é a partir de dentro da ficha, mesmo padrão de
  `teses_caso`/`tarefas_caso` que também não têm nav item próprio (são seções DENTRO da ficha).

Registrado explicitamente como **divergência deliberada e não incidental**, ao contrário da
divergência de UI acidental documentada no ADR 0013 (seção 5) entre `/app/auditor` e
`/app/advogado-contra` — aqui a diferença de padrão nasce de uma diferença real de domínio
(sempre-atrelado-a-caso vs. standalone-opcional), não de inconsistência de implementação entre
features irmãs.

### 7. Gating — 12ª chave em `FEATURES_PREMIUM`, Pro-only sem tier gratuito parcial

`lib/planos/gating.ts`, `FEATURES_PREMIUM` ganha `estrategista_caso` — mesmo padrão comercial das
6 features de análise estruturada por IA já existentes (itens 7-11 + esta). Nenhuma razão nova
para desviar: é geração de IA estruturada que consome o mesmo pool de chaves compartilhado
(`lib/ia/chaves/pool.ts`) e tem o mesmo custo de infraestrutura por chamada que as demais.

### 8. Gate de concorrência — `estrategias_caso` entra em `TABELAS_PROCESSAMENTO_IA`

`lib/ia/limite-concorrencia.ts`, `TABELAS_PROCESSAMENTO_IA` ganha `estrategias_caso` como 6ª
tabela verificada — mesmo mecanismo já generalizado desde o Auditor de Peças, só soma mais uma
tabela à lista (nenhuma mudança de mecanismo, mesmo racional do ADR 0013, seção 6).

### 9. Reaproveitamento concreto (sem duplicação)

- `lib/ia/chamada-estruturada.ts#gerarRespostaEstruturada` — 6ª feature a usar o helper (chat,
  análise de processo, Document Intelligence, Auditor de Peças, Advogado do Contra, agora
  Estrategista). Chamada text-only (sem parte multimodal — não há upload nesta feature).
- `criarTarefaCasoAction`/`listarTarefasCasoAction` (`app/app/fichas/[id]/tarefas-actions.ts`) —
  reuso direto, zero action nova de escrita de tarefa.
- `criarTeseManualAction`/`listarTesesCasoAction` (`app/app/fichas/actions.ts`) — reuso direto
  para o botão "Cadastrar como tese do caso" (seção 2) e para montar o contexto do prompt.
- `montarNovaTeseCaso`/`montarAtualizacaoStatusTese` (`lib/casos/teses.ts`) — nenhuma alteração,
  chamados por `criarTeseManualAction` já existente, não por código novo desta feature.

Não reaproveitado, por design: `CitacaoAnaliseProcesso` (seção 3 justifica a não-adoção),
`lib/analise-processo/extracao.ts` (sem upload nesta feature).

## Consequências

**Positivas**

- Primeira feature do produto a agregar múltiplas fontes estruturadas em vez de analisar um
  texto avulso — valida que `gerarRespostaEstruturada` também serve bem a prompts "de síntese",
  não só "de extração", sem exigir mudança no helper.
- Zero tabela de escrita nova além de `estrategias_caso`: tanto "confirmar próximo passo" quanto
  "cadastrar tese sugerida" reusam actions já existentes e testadas (`criarTarefaCasoAction`,
  `criarTeseManualAction`), reduzindo a superfície de código novo desta fase ao essencial
  (geração + leitura de contexto + UI de confirmação).
- `contexto_resumo` (seção 1) deixa a porta aberta para "esta estratégia pode estar
  desatualizada" sem exigir nova migração quando o produto quiser essa comparação — hoje é só
  metadado exibido, sem lógica de alerta automático.
- Divergência UI vs. Auditor/Advogado do Contra é justificada por diferença real de domínio, e
  documentada como tal — evita o próximo dev "corrigir" a ausência de rota standalone achando
  que é uma omissão.

**Negativas**

- 7ª tabela de "resultado de análise de IA" no projeto (`analises_risco_contratual`,
  `analises_documento`, `comparacoes_documento`, `analises_processo`, `auditorias_peca`,
  `analises_advogado_contra`, agora `estrategias_caso`) — mesma dívida de sobreposição conceitual
  já aceita nos ADRs 0011/0012/0013, agravada porque esta é a primeira que NÃO tem
  `ficha_caso_id` nullable, quebrando a simetria de "todas as tabelas de análise têm vínculo de
  ficha opcional" que existia até aqui — qualquer código genérico futuro que itere as 7 tabelas
  assumindo nullable precisa tratar esta como caso especial.
- `OrigemContextoEstrategia` (união de 5 variantes por tabela de origem) é mais tipos para manter
  do que um único `CitacaoAnaliseProcesso` reaproveitado — aceito porque forçar o formato de
  citação textual neste domínio produziria pior guardrail (seção 3), mas é a 6ª feature de IA
  estruturada do projeto e a primeira que NÃO compartilha o contrato de citação com as demais 4,
  criando dois "dialetos" de rastreabilidade no código (citação-de-texto vs.
  referência-de-linha-de-outra-tabela).
- Sem dedupe de "item já virou tarefa" no servidor (seção 5) — duplo-clique pode criar tarefas
  duplicadas; mitigação é só client-side/otimista, não uma constraint de banco.
- Sem tier gratuito parcial — mesma decisão comercial já aceita nas 6 features anteriores de
  análise estruturada.
- Teto de contexto agregado (120k caracteres, seção 4) e a lista de prioridade de truncamento por
  seção são heurísticas novas, sem precedente direto no projeto (as 5 features anteriores truncam
  um texto único, não priorizam entre fontes distintas) — primeira vez que o produto precisa de
  uma política explícita de "o que cortar primeiro quando o contexto for grande demais" além de
  corte por tamanho de string.

## Alternativas consideradas

1. **Atualizar um único registro "estratégia atual" por ficha (`fichas_caso.estrategia_atual_id`
   ou coluna 1:1)** — mais simples de exibir (sempre 1 resultado, sem lista de histórico), mas
   perde a trilha de "o que a IA recomendava quando o caso estava num estado anterior" — rejeitada
   pelo mesmo racional já aplicado a toda análise de IA no projeto (nunca sobrescrever, sempre
   versionar), reforçado aqui porque a entrada muda mais rápido que nas features anteriores
   (seção 1).
2. **Rota standalone `/app/estrategia` (lista + `/novo?fichaId=`), espelhando Auditor/Advogado do
   Contra** — mais consistente com o padrão das 5 features anteriores, mas cria uma tela de
   navegação sem função real (seção 6): 100% dos acessos partem de dentro de uma ficha já aberta,
   e uma "lista de todas as estratégias do escritório" não é um caso de uso do produto hoje.
   Rejeitada; pode ser revisitada com um ADR próprio se emergir demanda de dashboard cross-caso.
3. **Sempre CRIAR uma tese nova em `teses_caso` para a tese principal/subsidiárias sugeridas, em
   vez de só referenciar quando já existe equivalente** — mais simples de implementar (sem
   comparação semântica no prompt), mas cada geração de estratégia duplicaria teses já
   cadastradas, poluindo `teses_caso` com quase-duplicatas toda vez que o advogado gerar uma nova
   versão da estratégia sem que as teses do caso tenham mudado de fato. Rejeitada em favor da
   referência (seção 2), aceitando o custo de um prompt levemente mais complexo (precisa da lista
   de teses já cadastradas como contexto para tentar casar).
4. **Reaproveitar `CitacaoAnaliseProcesso` para `origem`, mapeando id de outra tabela para um
   `trechoOriginal` sintético** (ex.: `trechoOriginal: "Tese: <texto da tese>"`) — manteria os 4
   tipos de citação do projeto unificados em 5, mas forçaria a IA (ou o código de pós-
   processamento) a inventar um "trecho literal" que não é literal de lugar nenhum, e um número
   de `pagina` sempre `null` sem sentido — rejeitada por produzir um guardrail pior, não melhor
   (seção 3).
5. **Migrar/substituir o pipeline legado `gerarAnaliseIaAction` (`resumo_ia`/`questoes_ia`/
   `estrategia_ia`) por esta feature, unificando os dois** — tentador porque ambos preenchem o
   mesmo espaço conceitual ("qual a estratégia deste caso?"), mas migrar um pipeline estável em
   produção (usado por classificação de risco e indexação RAG) está fora do escopo desta fase, que
   é sobre adicionar uma capacidade nova, não sobre refatorar uma antiga — explicitamente fora de
   escopo por instrução. Tratado como sinal de baixa prioridade no contexto (seção 4, item 7), não
   substituído nem descontinuado; gatilho para um ADR próprio de descontinuação futura se o
   Estrategista se provar superior o suficiente para aposentar o pipeline legado.

## Plano de implementação (ondas)

**Onda 0 — `database`** (sequencial, bloqueia as demais):
- `supabase/migrations/0040_estrategias_caso.sql` (tabela + índices + RLS, `ficha_caso_id` NOT
  NULL — sem constraint condicional de origem, mais simples que `auditorias_peca`/
  `analises_advogado_contra` porque não há união de modos de entrada aqui).
- `lib/types.ts`: tipo `EstrategiaCaso` (apontando para `ResultadoEstrategiaCaso` em
  `lib/estrategia-caso/tipos.ts`, mesmo padrão de `AuditoriaPeca`/`AnaliseAdvogadoContra`).
- `lib/planos/gating.ts`: nova feature `estrategista_caso` em `FEATURES_PREMIUM` (12ª chave).
- `lib/ia/limite-concorrencia.ts`: `estrategias_caso` em `TABELAS_PROCESSAMENTO_IA` (6ª tabela).

**Onda 1 — `ai-engineer`** (depende só da Onda 0):
- `lib/estrategia-caso/tipos.ts`: `TeseEstrategiaCaso`, `OrigemContextoEstrategia`,
  `RiscoEstrategiaCaso`, `OportunidadeEstrategiaCaso`, `ProvaEstrategiaCaso`,
  `ProximoPassoEstrategiaCaso`, `AcaoRecomendadaEstrategiaCaso`, `ResultadoEstrategiaCaso` (seção
  3, sem reaproveitar `CitacaoAnaliseProcesso`).
- `lib/estrategia-caso/contexto.ts`: função pura que recebe os dados já buscados das 6 fontes
  (ficha, teses, eventos, pessoas, jurisprudência citada, resumos de análises) e monta o bloco de
  texto do prompt respeitando `TAMANHO_MAXIMO_CONTEXTO_ESTRATEGIA` e a ordem de prioridade da
  seção 4 (testável sem I/O — mesmo padrão de `montarNovaTeseCaso` em `lib/casos/teses.ts`).
- `lib/estrategia-caso/prompt.ts`: `ESTRATEGISTA_SYSTEM_PROMPT` (persona, instrução de tentar
  casar tese sugerida com tese já cadastrada antes de propor nova, guarda de humildade
  epistêmica sobre `ressalvas` quando contexto é escasso, guarda de prompt injection sobre
  qualquer texto embutido nas fontes lidas), `RESPONSE_SCHEMA` nativo do Gemini, parser Zod
  fail-closed (`parsearRespostaEstrategiaCaso`) com `.refine()` garantindo exatamente 1 tese
  `papel: "principal"` e checando que toda `teseCasoId` referenciada de fato veio da lista de
  teses enviada como contexto (nunca um id inventado pela IA).
- `lib/estrategia-caso/gerar.ts`: função principal — busca as 6 fontes (Supabase, RLS ativo),
  monta `contexto_resumo`, chama `montarPromptEstrategiaCaso` +
  `lib/ia/chamada-estruturada.ts#gerarRespostaEstruturada`, persiste em `estrategias_caso`.
- Testes: `lib/estrategia-caso/{contexto,prompt,gerar}.test.ts` (casos: ficha sem nenhuma tese
  cadastrada, contexto acima do teto exercitando corte por seção, `teseCasoId` inventado pela IA
  rejeitado pelo `.refine()`, resposta sem tese `principal`).

**Onda 2 — `senior-engineer`** (depende da Onda 1):
- `app/app/fichas/[id]/estrategia-actions.ts`: `gerarEstrategiaCasoAction(fichaCasoId)` (gate de
  plano + gate de concorrência ANTES de qualquer I/O), `listarEstrategiasCasoAction(fichaCasoId)`.
- `export const maxDuration = 120` no segmento de rota da ficha (mesmo teto das demais features
  de IA pesada one-shot).
- `components/app/estrategia-caso-resultado.tsx` (objetivo, teses com badge de origem
  cadastrada/sugerida + botão "Cadastrar como tese", provas disponíveis/necessárias, riscos por
  categoria/nível, oportunidades, próximos passos e ações recomendadas com checkbox "Criar
  tarefa" chamando `criarTarefaCasoAction` direto, lista de `ressalvas` sempre visível, histórico
  de versões anteriores colapsado).
- `app/app/fichas/[id]/page.tsx`: nova aba "Estratégia" ao lado das já existentes (Teses/
  Tarefas/Linha do tempo/Documentos), botão "Gerar estratégia" disparando a Server Action inline
  (sem navegação).

**Onda 3 — revisão** (paralelo): `security` (RLS da tabela nova, garantir que o contexto agregado
de um caso não vaza para outro escritório via join incorreto de `caso_jurisprudencia_citada`/
`jurisprudencias`, prompt injection através de qualquer campo de texto livre nas 6 fontes lidas —
ex.: `pessoas_caso.nome` ou `eventos_caso.descricao` controlados por terceiros) + `qa` (casos:
ficha sem teses/eventos/documentos analisados ainda, geração concorrente bloqueada pelo gate,
`teseCasoId` de outra ficha rejeitado, duplo-clique em "criar tarefa") + `techlead`.

## Arquivos lidos para este design

`docs/adrs/0012-auditor-de-pecas.md`, `docs/adrs/0013-advogado-do-contra.md`,
`app/app/fichas/actions.ts` (`gerarAnaliseIaAction`, `criarTeseManualAction`,
`atualizarStatusTeseAction`, `listarTesesCasoAction`), `lib/casos/teses.ts`,
`app/app/fichas/[id]/tarefas-actions.ts`, `supabase/migrations/0023_caso_pessoas.sql`,
`0024_caso_linha_tempo.sql` (tabela `eventos_caso`), `0025_caso_teses.sql`,
`0026_caso_jurisprudencia_citada.sql`, `0027_caso_tarefas.sql`, `0028_caso_memoria_ia.sql`,
`0030_analises_processo.sql`, `lib/types.ts` (trechos `TeseCaso`/`TarefaCaso`/
`CasoJurisprudenciaCitada`/`EventoCaso`), `lib/analise-processo/tipos.ts`
(`CitacaoAnaliseProcesso`, `TesePossivelAnaliseProcesso`), `lib/analise-processo/extracao.ts`
(trecho `TAMANHO_MAXIMO_TEXTO_ANALISE_PROCESSO`), `lib/planos/gating.ts`,
`lib/ia/limite-concorrencia.ts`, `lib/rag/tools.ts`.
