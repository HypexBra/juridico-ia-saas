# RAG com Atualização Diária — Como Plugar no Projeto

## O que esse pacote entrega

4 arquivos que juntos formam o pipeline diário de atualização da base jurídica (RAG) descrito no item **P0.4** do prompt de dev:

1. `schema-rag.sql` — tabela no Postgres com suporte a busca vetorial (extensão `pgvector`)
2. `lib-embeddings.ts` — função que transforma texto em vetor (embedding)
3. `lib-fontes-juridicas.ts` — onde ficam as funções de busca por fonte (DJEN, tribunais, legislação) — **aqui você precisa plugar as APIs reais**, deixei com dados de exemplo
4. `api-cron-atualizar-base.ts` — o job que roda todo dia: busca conteúdo novo, gera embedding, salva no banco
5. `lib-consultar-rag.ts` — como qualquer módulo de IA do produto (score de persuasão, advogado do contra, geração de peça) consulta essa base antes de responder
6. `vercel-cron-config.json` — configuração pra rodar isso todo dia automaticamente na Vercel

## Pré-requisitos que você precisa decidir/ter antes de colar isso no projeto

- **Banco com pgvector habilitado.** Se você usa Postgres na Vercel (Vercel Postgres/Neon/Supabase), é só rodar `CREATE EXTENSION vector;` uma vez — já incluí isso no `schema-rag.sql`.
- **Uma API de embeddings.** Usei a da OpenAI (`text-embedding-3-small`) porque é a mais barata e comum pra isso — precisa de uma `OPENAI_API_KEY`. Se preferir usar embeddings da Anthropic/outro provedor, a lógica muda pouco, é trocar a função `gerarEmbedding()`.
- **As fontes jurídicas reais.** O arquivo `lib-fontes-juridicas.ts` está com funções de exemplo (mockadas) para: DJEN, um tribunal superior genérico, e legislação federal. Você precisa trocar pelas URLs/APIs reais que quer monitorar. Como o projeto já tem integração com DJEN (mencionado no seu levantamento original), a função `buscarAtualizacoesDJEN()` pode reaproveitar essa integração existente em vez de ser recriada do zero.

## Como o fluxo funciona no dia a dia

1. Todo dia às 3h da manhã (horário configurável), a Vercel dispara `api-cron-atualizar-base.ts` automaticamente.
2. O job passa por cada fonte cadastrada em `lib-fontes-juridicas.ts` e busca só o que é novo desde a última execução (usa a data do último registro salvo).
3. Cada documento novo é quebrado em pedaços menores (chunks) — isso melhora a qualidade da busca depois.
4. Cada pedaço vira um vetor (embedding) e é salvo no Postgres junto com a fonte, a data e o link original.
5. Fica tudo pronto pra ser consultado. Quando qualquer módulo de IA (ex: gerar uma peça, sugerir uma tese) precisa de contexto jurídico atualizado, ele chama `consultarBaseJuridica()` de `lib-consultar-rag.ts`, que busca os trechos mais relevantes pra aquele caso e devolve com a fonte e a data — isso então entra no prompt da IA.

## Pente fino feito nessa revisão

A primeira versão tinha risco real de quebrar em produção com volume de dados de verdade. Corrigido:

- **Timeout de função serverless**: embeddings agora são gerados **em lote** (até 50 chunks por chamada à API), não um por um. Isso é o que faz o job conseguir terminar dentro do tempo limite da Vercel em vez de morrer no meio com muitos documentos novos no dia.
- **`maxDuration = 300`** configurado explicitamente no job — sem isso, a Vercel usa um limite padrão baixo que pode cortar a execução antes da hora.
- **Deduplicação por hash**: cada chunk agora tem um hash SHA-256 armazenado com constraint `UNIQUE`. Se o job rodar duas vezes ou reprocessar uma janela de data por engano, o mesmo trecho não entra duplicado.
- **Isolamento de erro por documento**: antes, um documento com problema derrubava a fonte inteira e perdia o que já tinha sido processado. Agora cada inserção é isolada — uma falha pontual vira uma contagem de "falhas" no resultado, sem descartar o resto.
- **Cast explícito `::vector` no INSERT** — sem isso, dependendo do driver, a conversão do embedding pro tipo vetorial do Postgres pode falhar silenciosamente e quebrar a busca por similaridade depois.

## Terceiro pente fino — 2 bugs reais encontrados

- **Cursor de incrementalidade tinha granularidade só de dia**: usava `MAX(data_publicacao)` (tipo `DATE`, sem hora) para saber "desde quando buscar". Isso funcionava rodando uma vez por dia, mas quebraria exatamente na sugestão que dei antes de rodar a cada 6h — a segunda execução do mesmo dia podia pular conteúdo publicado entre as duas execuções. Troquei por uma tabela de checkpoint (`rag_fonte_cursor`) com timestamp completo, marcado no **início** da busca (não no fim), para não perder nada publicado durante o próprio processamento.
- **Contagem de "novos" inflada em caso de conflito**: `ON CONFLICT DO NOTHING` não lança erro quando a linha já existe — só não insere. O código antigo incrementava `novos++` mesmo assim. Agora checa `rowCount` do insert antes de contar como novo — se for duplicata (inclusive duplicata dentro do próprio lote, que o pré-filtro contra o banco não pega), conta como ignorado, não como novo.
- Corrigido também o caso de "zero documentos novos" não atualizar o checkpoint — antes disso, se uma fonte não tivesse nada novo num dia, o job voltava a buscar a mesma janela de 30 dias pra trás no dia seguinte, pra sempre.

## Sobre "dados mais atualizados possível"

Mantive a execução **uma vez por dia**, como você pediu, mas com dois ajustes pra isso significar dado realmente fresco:

- **Horário às 5h da manhã** (não à noite): a maioria das publicações em diários oficiais e movimentações processuais do dia anterior já está consolidada até essa hora, então essa janela captura o dia inteiro anterior de forma completa, em vez de rodar no meio da tarde e pegar um dia pela metade.
- Se no futuro "diariamente" não for suficiente (por exemplo, se prazos fatais dependerem de saber de uma movimentação em poucas horas, não no dia seguinte), a mudança é trivial: trocar o `schedule` do cron para `0 */6 * * *` (a cada 6h) — o job já é incremental (só busca o que é novo desde a última execução), então rodar mais vezes ao dia não reprocessa nada demais, só reduz o atraso máximo entre a publicação e ela entrar na base.
