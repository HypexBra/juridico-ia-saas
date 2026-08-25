# 0016 — Workflow Engine (Fase 8)

## Status

Proposto (2026-08-22)

## Contexto

Até a Fase 7, toda automação do produto é **unitária e disparada à mão**: criar uma tarefa é
um clique na ficha (`criarTarefaCasoAction`), criar um prazo é um formulário em `/app/prazos`,
gerar documento condicional é um botão por vez (`gerarDocumentoCondicionalAction`), mensagem ao
cliente é um envio manual (`enviarMensagemEscritorioAction`). O escritório que atende N casos
com a MESMA rotina de entrada (abrir caso → gerar procuração → revisar → criar prazo de
contestação → avisar o cliente) repete a mesma sequência de cliques caso a caso.

A Fase 8 pede o primeiro motor de sequências do produto: o advogado define UMA VEZ uma cadeia
ordenada de etapas e dispara sobre qualquer `fichas_caso`. Isso levanta questões que nenhuma
feature anterior enfrentou:

1. **Estado multi-passo**: uma execução tem etapas pendentes/concluídas/falhas — não é
   one-shot como as análises de IA.
2. **Human-in-the-loop obrigatório por padrão**: automação jurídica sem ponto de revisão
   humana é inaceitável para o domínio (prazo errado criado automaticamente = dano real).
3. **Efeitos colaterais em tabelas operacionais EXISTENTES** (`tarefas_caso`, `prazos`,
   `mensagens_portal_cliente`, `documentos_condicionais_gerados`) — o workflow é o PRIMEIRO
   recurso do produto que escreve em tabelas de outras features; nunca inventar schema.
4. **Auditoria**: "o que este workflow fez neste caso, quando e com qual resultado" precisa
   sobreviver à edição e até à exclusão da definição.

## Decisão

### 1. Schema — 4 tabelas: definição editável + execução snapshot append-only

```sql
workflows            (definição: nome, descricao, ativo, criado_por)
workflow_etapas      (definição: workflow_id, ordem UNIQUE(workflow_id, ordem),
                      tipo_acao CHECK IN (...), titulo, configuracao jsonb)
workflow_execucoes   (disparo: workflow_id SET NULL + workflow_nome SNAPSHOT,
                      ficha_caso_id CASCADE, status, iniciada_por, concluida_em)
workflow_execucao_etapas (instância: execucao_id CASCADE,
                      etapa_origem_id SET NULL + cópia própria de ordem/tipo/titulo/config,
                      status CHECK, resultado jsonb, executada_em)
```

Mesmo racional já estabelecido nas features de análise (ADR 0014, seção 1) mas com motivo mais
forte: a execução é um HISTÓRICO OPERACIONAL do caso. Por isso:

- `workflow_execucoes.workflow_id` é **ON DELETE SET NULL com snapshot `workflow_nome`**:
  excluir um workflow não pode apagar o registro do que rodou nos casos (obrigação de
  auditoria jurídica).
- `workflow_execucao_etapas.etapa_origem_id` é SET NULL e a etapa instanciada guarda CÓPIA
  própria (`titulo`/`tipo_acao`/`configuracao`): se o advogado editar a definição depois do
  disparo, o histórico continua fiel ao que RODOU na época — join em dado vivo aqui seria
  mentira retrospectiva.
- TODAS as tabelas carregam `escritorio_id` desnormalizado (padrão multi-tenant do projeto):
  policy RLS única `for all using (escritorio_id = escritorio_atual())` nomeada
  `<tabela>_isolamento`, sem join — inclusive nas filhas, onde a desnormalização é o que
  torna a policy possível.
- Índices: `idx_<tabela>_escritorio` nas 4 + compostos de leitura canônica
  `(workflow_id, ordem)` nas etapas de definição, `(escritorio_id, status)` e
  `(ficha_caso_id, criado_em desc)` nas execuções, `(execucao_id, ordem)` nas instâncias.

### 2. Tipos e validação — união discriminada por tipo de ação

`lib/workflows/tipos.ts`: `ConfiguracaoAcao` discrimina por `tipo_acao` embutido na
configuração normalizada (`{ tipo_acao: "criar_prazo"; titulo_prazo: string;
dias_apos_inicio: number } | ...`). A configuração trafega jsonb, então nomes em snake_case
mesmo dialecto das colunas. `ROTULO_ACAO`/`DESCRICAO_ACAO` centralizam os rótulos pt-BR da UI
(editor, stepper e listagem usam o MESMO dicionário — zero string duplicada).

### 3. Motor puro — máquina de estados decidível sem I/O

`lib/workflows/motor.ts` (sem Supabase, testável direto — mesmo padrão de
`lib/mailmerge-condicional/motor.ts`):

- `validarDefinicaoWorkflow(etapas)` — ≥1 etapa, títulos presentes (teto varchar(200)),
  configuração válida POR TIPO (campos obrigatórios, dias ≥ 0 inteiros, uuid plausível para
  modelo), ordens únicas. Acumula TODOS os erros (o editor mostra a lista completa).
- `avancarExecucao(definicao, statusPorOrdem)` — dado o estado atual das etapas, retorna
  `{ executar: ordens[], aguardandoHumano: ordem | null }`: as automáticas consecutivas a
  rodar agora, parando ANTES da primeira `aprovar_humano` pendente (que vira
  `aguardando_humano`). Estados que congelam a cadeia (`falha`, `executando`, `cancelada`,
  `aguardando_humano`) retornam plano vazio — a action é idempotente por construção.
- `resumoProgresso(etapas)` — `{ total, concluidas, atual }` para o stepper da UI.

Regras contratuais da Fase 8 implementadas exatamente: TODAS as etapas executam
automaticamente em sequência EXCETO `aprovar_humano` (pausa); `gerar_documento` NÃO pausa —
executa, grava resultado e segue; falha marca a etapa `falha` com `{erro}` amigável e PARA a
cadeia, mantendo a EXECUÇÃO `em_andamento` de propósito (retry só da etapa).

### 4. Execução — síncrona dentro da Server Action, sem fila nem worker

A cadeia roda síncrona em `executarCadeiaAutomatica` (função interna compartilhada pelas três
portas de retomada: `iniciarExecucaoAction`, `concluirEtapaHumanaAction`,
`reprocessarEtapaAction`). Justificado porque as ações da cadeia são baratas e determinísticas
(inserts locais + mail-merge puro — ZERO chamada de IA na cadeia): latência total típica <
algumas centenas de ms. Fila/worker seria infraestrutura nova (cron, polling na UI, outro
processo) sem ganho perceptível hoje; gatilho explícito para revisitar: se alguma etapa passar
a chamar IA pesada, migrar para assíncrona com novo ADR.

Cada etapa transita por `pendente → executando → concluida|falha` com `resultado` jsonb
(ids criados, contagem de mensagens, preview do documento) e `executada_em` — o painel mostra
o resumo curto, nunca JSON cru.

### 5. Human-in-the-loop por padrão — e retry granular

`aprovar_humano` é um TIPO DE ETAPA (o autor do workflow decide ONDE a revisão humana cabe),
não uma flag global. Ao ser alcançada pela cadeia, entra `aguardando_humano`; só
`concluirEtapaHumanaAction` retoma. Falha também exige decisão humana — mas granular:
`reprocessarEtapaAction` refaz APENAS a etapa falhada (guardando a trilha anterior em
`resultado.historico_falha`) e retoma a cadeia dali; nunca reiniciar a execução inteira (isso
duplicaria tarefas/prazos já criados). Cancelamento (`cancelarExecucaoAction`) é terminal:
cancela execução + pendentes/aguardando.

### 6. Efeitos colaterais — REUSE dos schemas reais, zero invenção

Cada tipo de ação escreve nas tabelas/fontes JÁ existentes, com os mesmos campos das actions
originais (verificadas, não supostas):

| Etapa | Escreve em | Fonte copiada |
|---|---|---|
| `criar_tarefa` | `tarefas_caso` (status `pendente`, prioridade `media`, `prazo_opcional` = hoje+N dias ou null) | migration 0027 + 0043 |
| `criar_prazo` | `prazos` (titulo, data_prazo = início+N dias, origem `manual`; defaults do banco cobrem o resto) | migrations 0001/0003/0010 |
| `gerar_documento` | mail-merge condicional + `documentos_condicionais_gerados` (MESMOS campos de `gerarDocumentoCondicionalAction`) | `app/app/fichas/[id]/mail-merge-condicional-actions.ts` |
| `mensagem_portal` | `mensagens_portal_cliente` (remetente `escritorio`) para TODO cliente ativo do portal da ficha + `notificarClientePortal` fire-and-forget | `app/app/fichas/[id]/mensagens-actions.ts` |

Falhas de DOMÍNIO são amigáveis e viram falha da ETAPA (com retry), não crash: modelo
excluído, sintaxe do modelo quebrada (`MotorTemplateCondicionalError`), caso sem cliente
ativo no portal. Erros inesperados gravam mensagem genérica na etapa e logam contexto real no
server — stack trace nunca vaza para o client (padrão do projeto).

Divergência consciente de nome: a tabela do portal é `mensagens_portal_cliente` (não
"mensagens_portal") — descoberta lendo a action oficial antes de escrever qualquer insert.

### 7. Gating — 15ª chave em `FEATURES_PREMIUM`

`workflows_automacao`, Pro-only sem tier gratuito parcial (mesmo padrão comercial das demais).
É a feature que mais ESCREVE em dados operacionais do produto — o valor entregue é
diretamente operacional, coerente com paywall integral. Página inteira gated com upsell
idêntico ao Redline (`/app/perfil`); gate checado PRIMEIRO após auth em TODAS as actions,
antes de qualquer I/O.

### 8. UI — página única `/app/workflows`, editor inline, painel inline

Sem rotas dinâmicas de detalhe (decisão do design contratado): listagem + editor inline +
seletor de caso inline ("Executar" abre select das últimas 50 fichas ativas) + painel de
execuções recentes com stepper expansível na MESMA página. Menos rotas = menos superfície de
auth/gating/revalidação para a mesma função. Sidebar ganha "Workflows" (entre Modelos e
Redline — modelos alimentam `gerar_documento`); command center ganha comando no grupo
"Gestão".

## Consequências

**Positivas**

- Primeiro motor de sequência do produto com máquina de estados PURA e testada (21 testes
  vitest sem mock de I/O) — a lógica de avanço/pausa/falha é verificável isoladamente, e a
  camada de I/O fica fina.
- Histórico de execuções imune a edição/exclusão de definição (snapshots duplos: nome do
  workflow e conteúdo das etapas).
- Zero schema novo fora das 4 tabelas da fase; todos os efeitos colaterais reusam as tabelas
  e campos das features originais.
- Retry granular evita a classe inteira de bugs "reexecutar tudo duplicou prazos".

**Negativas**

- Cadeia síncrona na action: se uma etapa futura chamar IA pesada, a UX degradará e exigirá a
  migração para execução assíncrona (worker/fila + polling/Realtime na UI) — registrado como
  gatilho de novo ADR.
- Upsert de definição (delete+insert de etapas) não é transacional — client Supabase SSR não
  expõe transação multi-statement; janela mínima de inconsistência aceita e documentada
  (estado resultante visível/recuperável pela UI, sem corromper outras tabelas).
- Sem dedupe de disparos simultâneos do mesmo workflow sobre a mesma ficha: dois cliques
  rápidos criam duas execuções (mitigação client-side desabilitando o botão durante
  `pending`; constraint de banco seria over-engineering para o risco atual).
- `mensagem_portal` depende de o caso ter cliente ATIVO no portal — caso comum de falha de
  etapa na prática; mitigado com erro amigável acionável ("convide o cliente na ficha e
  reprocesse").

## Alternativas consideradas

1. **Execução assíncrona desde v1 (fila/BullMQ/cron + tabela de jobs)** — robustez máxima,
   mas introduz processo extra, polling na UI e observabilidade nova para uma carga cujas
   etapas são inserts baratos; rejeitada nesta fase (seção 4 registra o gatilho de revisão).
2. **Workflow com ramificações condicionais (grafo DAG)** — poder expressivo maior, mas a
   demanda real da fase são ROTINAS LINEARES de entrada/atendimento; condição por etapa
   multiplicaria o editor e a máquina de estados. Sequência ordenada + aprovação humana
   (que permite decisão implícita) cobre o MVP; DAG fica para um ADR futuro se houver demanda.
3. **Reaproveitar `eventos_caso` como log de execução** — economizaria 2 tabelas, mas mistura
   linha-do-tempo narrativa do caso (append-only, exibida na ficha) com estado operacional
   mutável de automação; consultas e RLS divergem. Rejeitado.
4. **Etapa "esperar X dias" (delay)** — tentadora para rotinas (avisar cliente 3 dias depois),
   mas exige scheduler; fora de escopo da fase. Composição possível hoje: criar TAREFA com
   prazo_dias (humana vê na agenda) — mesmo efeito com revisão humana, sem infra nova.

## Plano de implementação (ondas)

**Onda 0 — `database`**: `supabase/migrations/0044_workflows.sql` (4 tabelas, checks,
índices `idx_*`, policies `<tabela>_isolamento`); `lib/planos/gating.ts` ganha
`workflows_automacao`.

**Onda 1 — `senior-engineer` (pura)**: `lib/workflows/tipos.ts` (união discriminada +
rótulos); `lib/workflows/motor.ts` + `motor.test.ts` (TDD: vermelho antes da implementação —
validação por tipo, ordens duplicadas, sequência automática, pausa/retomada humana, falha).

**Onda 2 — `senior-engineer` (I/O + UI)**: `app/app/workflows/actions.ts` (CRUD + execução +
human-in-the-loop + cancelamento, todas com auth → gate → zod → motor);
`app/app/workflows/page.tsx` (server component, gating com upsell); 
`components/app/{workflow-editor,workflow-execucoes,workflow-painel}.tsx`; sidebar +
command-center.

**Onda 3 — verificação**: `npx vitest run lib/workflows` verde; `npm run build`/`npm test`
centrais posteriores (máquina local com RAM limitada).

## Arquivos lidos para este design

`docs/adrs/0014-estrategista-caso.md` (formato), `app/app/calculadoras/actions.ts` (padrão de
action), `lib/mailmerge-condicional/motor.ts` e `montar-dados.ts` (estilo de motor puro +
contexto do merge), `app/app/fichas/[id]/mail-merge-condicional-actions.ts` (persistência de
documento gerado), `app/app/fichas/[id]/mensagens-actions.ts` (schema real do portal +
notificação), `lib/notificacoes/notificar-cliente.ts`, `lib/mensagens-portal/mensagens.ts`,
`lib/types.ts` (TarefaCaso/Prazo/FichaCaso/MensagemPortalCliente), `lib/planos/gating.ts`,
`components/app/sidebar.tsx` e `command-center.tsx`, `app/app/redline/page.tsx` (upsell),
`supabase/migrations/0001_init.sql` (prazos + `escritorio_atual()`),
`0043_tarefas_prioridade.sql` (padrão), `vitest.config.ts`.
