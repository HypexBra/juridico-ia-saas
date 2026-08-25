# 0017 — Auto-fill de documentos a partir do Caso Inteligente (Fase 9)

## Status

Proposto (2026-08-22)

## Contexto

O mail-merge condicional (`lib/mailmerge-condicional/motor.ts`, feature Pro
"automacao_documento_condicional") resolve modelos com blocos
`{{#se}}`/`{{#cada}}` de forma 100% determinística — mas o contexto disponível
para essa resolução era limitado ao que `montarDadosCondicionaisDaFicha`
(`montar-dados.ts`) produz: `nome_cliente`, `numero_processo`, `area_direito`,
`valor_causa`, `data_hoje` e as coleções `parcelas[]`, `prazos[]`,
`contratos[]`. Ou seja: o documento automatizado enxerga o FINANCEIRO e os
PRAZOS da ficha, mas não enxerga nada do Caso Inteligente construído nas Fases
1–6 — pessoas envolvidas (`pessoas_caso`, migration 0023), linha do tempo
(`eventos_caso`, migration 0024), teses avaliadas (`teses_caso`, migration
0025), tarefas internas com prioridade (`tarefas_caso`, migrations
0027/0043) e a estratégia gerada pelo Estrategista Jurídico
(`estrategias_caso`, migration 0041, ADR 0014).

Isso limita os casos de uso reais da automação: um modelo de petição não
consegue listar as partes adversas, narrar a linha do tempo do caso, citar as
teses adotadas nem abrir com o objetivo estratégico definido — tudo que já
existe estruturado no banco. O usuário teria que redigir isso à mão em cada
documento, exatamente o trabalho que a automação deveria eliminar.

Requisitos da fase: nenhuma mudança de schema, nenhuma mudança no motor puro
(que já trata dado ausente como "não informado" sem quebrar), e nenhuma
regressão na geração existente.

## Decisão

### 1. Novo módulo puro `contexto-caso.ts` — mapeamento, nunca I/O

`montarContextoCaso(entrada)` recebe os dados JÁ BUSCADOS (mesmo contrato de
`montar-dados.ts`: tipos próprios espelhando só os campos usados, snake_case)
e devolve um bloco `ContextoCasoExtra` mesclável por spread:

- **Raiz**: `total_pessoas`, `total_eventos`, `total_tarefas`, `total_teses`
  (contadores úteis para frases como "o caso possui {{total_eventos}}
  movimentações") e `estrategia_objetivo` / `estrategia_tese_principal`
  (string vazia quando não há estratégia — o motor converte "" em "não
  informado" e registra em `variaveisNaoResolvidas`, mesma convenção de dado
  ausente do resto do sistema).
- **Coleções novas** (itens `RegistroTemplate` com `indice` 1-based):
  - `pessoas[]` — `nome`, `tipo` ('parte'/'adverso'/'testemunha'/'terceiro'),
    `papel_processual`, `documento`, `contato` + derivados `adversa`,
    `tem_documento`, `tem_contato` (flags prontas para `{{#se adversa}}`, sem
    exigir que o autor decore valores exatos de coluna).
  - `eventos[]` — `data` (pt-BR), `descricao`, `tipo_evento`, `origem` +
    derivado `ultimo` (marca o evento mais recente; lista ordenada por
    `data_evento` ascendente).
  - `teses[]` — `tese`, `fundamentacao`, `status` + derivado `adotada`.
  - `tarefas[]` — `titulo`, `status`, `prioridade`, `prazo` + derivados
    `concluida` e `atrasada` (prazo vencido e ainda ativa — mesmo critério de
    `parcelas[].atrasada`). Ordenação: pendentes/em_andamento antes das
    concluídas, prioridade desc (alta→baixa, ordem do dashboard definida na
    migration 0043), prazo mais próximo primeiro, sem prazo por último.
- Derivados por coleção seguem o padrão já estabelecido em `montar-dados.ts`
  (`atrasada`/`dias_atraso`): lógica de apresentação calculada no código,
  nunca dependente de o usuário manter campos manuais coerentes.

Função PURA e total: ficha recém-criada devolve totais 0, arrays vazios e
strings vazias — nunca exceção. Testada isoladamente sem mock de Supabase
(mesma justificativa de separação de `montar-dados.ts`, ADR implícito do
arquivo original).

### 2. Tese principal da estratégia — reconciliação com o dado vivo, nunca texto congelado

O jsonb `resultado_estrategia` guarda a tese principal como REFERÊNCIA
(`origem: "tese_cadastrada"` carrega apenas `teseCasoId`) ou como texto livre
(`origem: "sugerida"`). O contexto resolve `estrategia_tese_principal` assim:
quando `sugerida`, usa o texto do próprio jsonb; quando `tese_cadastrada`,
busca a tese ATUAL na lista de `teses_caso` da ficha (já carregada para a
coleção `teses[]`) — mesmo racional do ADR 0014, seção 2 ("reconciliar com o
dado vivo"): se o advogado editar a tese depois de gerar a estratégia, o
documento reflete a versão corrente, não uma cópia congelada. ID inexistente
na ficha → string vazia ("não informado"), nunca erro.

O estreitamento do jsonb é defensivo campo a campo (sem Zod — jsonb gravado
por IA pode divergir do shape TS): qualquer desvio (`objetivo` numérico,
`teses` não-array, item null) vira "" e segue o fluxo, porque falha de shape
de ENRIQUECIMENTO não pode derrubar uma geração de documento.

### 3. Catálogo estático `catalogo-variaveis.ts` — documentação viva com garantia por teste

`CATALOGO_VARIAVEIS_CASO` é um array agrupado `{ grupo, colecao, variaveis[]
}` cobrindo TODAS as chaves resolvíveis: as pré-existentes (ficha +
campos internos de `parcelas`/`prazos`/`contratos` no formato documentado,
ex.: `{{#cada parcelas}}{{valor}}…{{/cada}}`) e as novas do Caso Inteligente.
Duas garantias por teste:

1. Unicidade de chaves raiz entre grupos.
2. **Cobertura exata**: todo campo gerado pelas funções de montagem aparece
   no catálogo — e, para as coleções novas, a igualdade é bidirecional
   (nenhuma chave catalogada inexistente, nenhum campo gerado indocumentado).

Consequência prática: o catálogo não pode apodrecer. Se alguém adicionar um
campo numa função de montagem sem atualizar o catálogo, o teste quebra; se
documentar uma variável que o motor não resolve, também. `variaveisRaizDoCatalogo()`
e `variaveisDaColecao(colecao)` expõem leitura programática.

Catálogo é PURO e estático: importado pela page server da ficha e repassado
como prop ao card client — zero I/O, serialização trivial de objetos planos.

### 4. Plug na action — merge defensivo com tolerância a falha por fonte

`gerarDocumentoCondicionalAction` ganha 5 queries extras (uma por fonte),
rodando em paralelo via `Promise.all` após o contexto base já montado:
`.eq("ficha_caso_id", fichaId)` (mesmo padrão das queries de prazos;
RLS por escritorio_id continua sendo a fronteira multi-tenant real),
ordenações alinhadas aos índices das migrations e `.limit(1).maybeSingle()` +
`.eq("status", "pronto")` para a MAIS RECENTE estratégia utilizável
('processando'/'erro' não têm jsonb preenchido).

Cada fonte falha INDEPENDENTEMENTE: erro em qualquer query extra é logado
(`console.error` com prefixo do arquivo, padrão do projeto) e a geração
segue com as fontes saudáveis — as variáveis faltantes viram "não
informado"/coleção vazia, comportamento já previsto pelo motor para dado
ausente. Justificativa: o contexto base (ficha/prazos/contratos/parcelas)
já veio completo; enriquecimento é opcional por natureza, e bloquear a
geração de um DOCUMENTO por indisponibilidade de uma tabela auxiliar
transformaria melhora de produto em ponto único de falha. O merge
`{...dadosExistentes, ...contextoCaso}` mantém o contexto base vencedor em
qualquer colisão futura de chave (hoje impossível: prefixos distintos).

Contrato de retorno da action permanece idêntico (mesmo
`GerarDocumentoCondicionalResultado`), auditoria em
`documentos_condicionais_gerados` intacta.

### 5. UI — seção "Variáveis disponíveis" no card de automação condicional

`AutomacaoCondicionalCard` recebe `catalogoVariaveis` via props e renderiza a
seção colapsável (botão com `aria-expanded`/`aria-controls`) com filtro por
texto simples sobre chave/descrição (~40 variáveis justam busca), agrupada
pelo título do grupo, `<code>` para cada chave (formato `{{chave}}` na raiz;
campo nu dentro de grupos de coleção, com o wrapper `{{#cada x}}…{{/x}}`
exibido no cabeçalho do grupo). Tokens do tema existentes
(`border-white/10`, `bg-white/5`, `text-muted`, `text-silver-2`, `text-ice`),
sem dependência nova. A seção aparece tanto no estado principal quanto no
estado "nenhum modelo cadastrado" — é na autoria do primeiro modelo que a
lista é mais necessária; no gate Pro ela fica oculta (usuário free não pode
gerar).

## Consequências

**Positivas**

- Modelos de documento passam a acessar TODO o patrimônio estruturado do caso
  (partes, timeline, teses, tarefas, estratégia) sem nenhuma digitação manual
  — fechando o loop "caso inteligente → documento".
- Zero migração, zero alteração no motor e zero mudança de contratos públicos:
  a entrega é aditiva (módulo novo + catálogo novo + queries extras na action
  + seção de UI).
- Falha parcial é degradada, nunca propagada: indisponibilidade de uma fonte
  do caso não impede a geração do documento (resiliência > rigidez).
- Catálogo com garantia mecanizada de sincronia com as funções de montagem —
  a documentação da UI não é um artefato que apodrece.

**Negativas**

- Cada geração passa a fazer até 5 round-trips extras ao Supabase em paralelo.
  Aceito: são queries indexadas por `ficha_caso_id`, volume por ficha é baixo
  (dezenas no máximo) e o gate de plano Pro já limita quem executa.
- `ContextoCasoExtra` duplica conceitos que o Estrategista também consome
  (teses/eventos/pessoas) em outro formato (registros planos para template vs.
  tipos ricos de `lib/casos/*`): custo consciente — templates precisam de
  strings/null prontos para interpolação, não de objetos de domínio.
- `estrategia_tese_principal` depende de reconciliação em runtime contra
  `teses_caso`; se a tese referenciada for EXCLUÍDA da ficha depois da geração
  da estratégia, a variável vira "não informado" (avisado ao usuário via
  `variaveisNaoResolvidas`), não há fallback para o texto congelado do jsonb —
  preferência explícita por dado vivo (seção 2).
- O estreitamento defensivo do jsonb aceita silênciosamente shapes parciais
  (log ausente); deliberado — o diagnóstico de estratégia malformada já é
  responsabilidade do fluxo do Estrategista, não da geração de documentos.

## Alternativas consideradas

1. **Estender `montarDadosCondicionaisDaFicha` com as novas fontes** — menos
   um arquivo, mas misturaria dois domínios de dado (financeiro/processual da
   ficha vs. Caso Inteligente) numa única entrada gigante e dificultaria testar
   o bloco novo isoladamente. Rejeitada: composição por módulos puros
   (`{...dados, ...contexto}`) é mais simples e cada peça tem teste próprio.
2. **Resolver a tese principal no banco (RPC/view com join)** — evitaria o
   lookup em runtime, mas adicionaria migration e lógica SQL para um caso que
   a lista de teses já carregada resolve em memória. Rejeitada por custo/benefício.
3. **Zod no jsonb da estratégia** — validação mais rica, mas introduziria a
   primeira dependência de schema-validação neste fluxo (o projeto valida
   jsonb de IA por estreitamento defensivo nos consumidores) para proteger um
   caminho cujo pior caso é "não informado". Rejeitada; revisitável se o
   consumo do jsonb crescer.
4. **Catálogo derivado em runtime do contexto real da ficha** — sempre correto
   por construção, mas exigiria I/O para listá-lo e esconderia variáveis de
   fontes momentaneamente vazias (confundindo o autor do modelo, que precisa
   saber o que EXISTE, não o que está preenchido agora). Rejeitada em favor
   do estático com garantia por teste.
5. **Seção de variáveis como página/modal própria** — mais espaço visual,
   mas tira o autor do fluxo de edição; colapsável inline no card mantém o
   contexto na tela onde o modelo é usado. Rejeitada por simplicidade.

## Arquivos lidos para este design

`lib/mailmerge-condicional/motor.ts`, `montar-dados.ts` (+ testes),
`app/app/fichas/[id]/mail-merge-condicional-actions.ts`,
`components/app/automacao-condicional-card.tsx`, `app/app/fichas/[id]/page.tsx`,
`supabase/migrations/0023_caso_pessoas.sql`, `0024_caso_linha_tempo.sql`,
`0025_caso_teses.sql`, `0027_caso_tarefas.sql`, `0043_tarefas_prioridade.sql`,
`0041_estrategia_caso.sql`, `lib/types.ts` (trechos `PessoaCaso`/`EventoCaso`/
`TeseCaso`/`TarefaCaso`), `lib/estrategia-caso/tipos.ts`
(`ResultadoEstrategiaCaso`), `app/app/fichas/[id]/estrategia-actions.ts`
(padrão de query da estratégia pronta), `docs/adrs/0014-estrategista-caso.md`.
