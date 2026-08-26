# Otimização do RAG e do pipeline de IA

Objetivo: **responder mais rápido, gastar menos token e errar menos por
desatualização**. Os três puxam para lados opostos se tratados como um
interruptor único (pesquisar sempre = lento e caro; nunca pesquisar = errado).
A solução foi parar de decidir isso uma vez para todas as mensagens.

## O diagnóstico

O pipeline tinha **dois** estados, decididos por `mensagemTrivial()`:

| | RAG | Pesquisa web | Thinking |
|---|---|---|---|
| trivial ("oi") | não | não | 0 |
| **todo o resto** | **sim** | **sim** | 256 |

O problema é a segunda linha. `googleSearch` é uma busca server-side de
segundos, cobrada em tokens de prompt, e estava ligada em **100% das mensagens
não-triviais**. "Resuma o documento que subi" pagava a mesma pesquisa na
internet que "o STJ mudou o entendimento sobre isso?".

Somado a isso, três desperdícios silenciosos:

1. **Contexto RAG sem teto.** 6 chunks × até 1800 chars = até ~10.800 chars
   (~3.000 tokens) em toda mensagem, mesmo quando o 5º e o 6º eram vizinhos
   sobrepostos do mesmo documento ou estavam muito atrás do primeiro colocado.
2. **Histórico sem teto agregado.** `MAX_CHARS_TURNO_ANTIGO` limitava cada
   turno (900 chars), mas não a soma: 19 turnos = ~17.100 chars (~4.500
   tokens) reenviados a cada mensagem, crescendo com a conversa.
3. **Só o chat usava RAG.** Advogado do Contra, Estrategista e as demais
   features montavam prompt sem consultar base nenhuma.

## O que mudou

### 1. Roteamento de contexto em 3 modos · `lib/ia/roteador-contexto.ts`

Função pura, sem I/O, roda antes de qualquer chamada cara.

| Modo | Quando | RAG | Web | Thinking |
|---|---|---|---|---|
| `rapido` | interação social | não | não | 0 |
| `interno` | pergunta jurídica respondível com a base própria | **sim** | **não** | normal |
| `atualizado` | depende do estado atual do mundo | sim | sim | normal |

`atualizado` dispara em dois grupos de sinal:

- **recência**: atual, hoje, recente, últimas, mudou, revogado, vigente,
  em vigor, ainda vale, entrou em vigor, este ano…
- **fonte externa mutável**: jurisprudência, entendimento, súmula, precedente,
  tema N, repetitivo, repercussão geral, STF/STJ/TST, Selic, IPCA, salário
  mínimo, teto do INSS, nova lei, reforma…

`interno` dispara em sinais de trabalho sobre material próprio (resuma,
reescreva, corrija, revise, meus/minhas, neste, acima, anexo, subi).

**Assimetria deliberada dos defaults.** Na dúvida entre `rapido` e `interno`,
vai para `interno` (custa uma query no banco). Na dúvida entre `interno` e
`atualizado`, o sinal de recência **vence** o de trabalho interno: "gere a
petição citando a jurisprudência mais recente" precisa da web, mesmo casando
com "gere". O erro barato é gastar contexto à toa; o erro caro é afirmar
jurisprudência revogada com cara de certeza.

Quando nada casa, o default é `interno`, não `atualizado`. É a decisão de
maior impacto no custo: a pergunta jurídica genérica ("qual o prazo para
contestação no procedimento comum?") é sobre conceito estável e deixa de pagar
a pesquisa. A rede de segurança já existia: o `RAG_TOOLING_PROMPT` obriga o
modelo a admitir quando respondeu sem base verificada · falha visível, não
silenciosa.

### 2. Pesquisa condicional e datada · `lib/ia/gemini.ts`, `lib/ia/rag-prompt.ts`

`configPara` passou a montar as tools por necessidade em vez de tudo-ou-nada:
`googleSearch` só entra no modo `atualizado`; o function-calling `propose_*`
segue a decisão do caller, independente da pesquisa (uma pergunta interna
ainda pode gerar proposta de ação).

No modo `atualizado`, e **só nele**, a systemInstruction recebe
`PESQUISA_ATUALIZADA_PROMPT`, que exige:

- usar a pesquisa antes de afirmar estado atual, mesmo "lembrando" a resposta;
- **datar** toda informação encontrada ("julgado em 03/2026");
- apontar explicitamente quando pesquisa e base interna divergirem, em vez de
  escolher uma em silêncio · a base do escritório pode estar velha, e é
  exatamente isso que o advogado precisa saber;
- nunca preencher lacuna com processo/relator/data plausíveis mas não
  verificados.

Esse bloco não entra nos outros modos de propósito: instruir a "citar a data
da pesquisa" quando não houve pesquisa é o caminho mais curto para o modelo
inventar uma data.

### 3. Seleção de chunks com orçamento · `lib/rag/selecao.ts`

A seleção saiu de dentro da função de busca e virou uma função pura, testada,
com quatro filtros em cima do que a busca vetorial devolve:

- **corte relativo ao melhor resultado** (margem 0.18). Um chunk a 0.68 passa
  no corte absoluto de 0.7, mas se o melhor veio a 0.22 ele é assunto vizinho,
  não resposta. Antes entrava e custava ~450 tokens.
- **deduplicação por sobreposição de texto** (shingles de 5 palavras,
  assimétrica). `lib/rag/chunking.ts` gera 200 chars de overlap de propósito;
  dois chunks vizinhos são parcialmente o mesmo parágrafo e pontuam parecido
  na mesma pergunta. Pagar duas vezes pelo mesmo texto é desperdício puro.
- **orçamento de 6.000 chars** somados.
- teto por `fonte_tipo` (diversidade), que já existia.

Dois invariantes: o **primeiro colocado nunca é descartado** (nem por
orçamento, nem por margem · ele define a margem), e a ordem é sempre por
relevância. Candidatos pedidos à RPC subiram de 2× para 3× o topK, para a
seleção ter de onde escolher depois de descartar.

Emite `evento: "rag_selecao_chunks"` no log quando houve descarte, com os
contadores por filtro.

### 4. Orçamento agregado de histórico · `lib/app/chat-shared.ts`

`recortarHistoricoPorOrcamento` corta de trás para frente até 8.000 chars
(~2.000 tokens), preservando sempre o último turno anterior mesmo que sozinho
estoure · perder a troca imediatamente anterior quebra a continuidade, e é o
turno que quase sempre importa.

Aplicado nos **dois** caminhos do chat (rota de streaming e Server Action), que
antes divergiam.

### 5. RAG nas outras features de IA

- **Advogado do Contra** (modos colado e tese cadastrada) · atacar uma tese sem
  consultar precedente é o erro que a feature existe para evitar.
- **Estrategista de Caso** · consulta montada a partir do que identifica o caso
  juridicamente (área + fatos + teses), não do dossiê inteiro: texto longo
  demais dilui o vetor e devolve resultado genérico.

Ambos via `lib/rag/contexto-juridico.ts`, restrito a
`fonte_tipo = 'jurisprudencia'` (contra-argumentar uma tese com a ficha interna
do próprio caso seria circular) e com instrução de citar fonte/data.

## Um bug encontrado no caminho

As listas de sinal do roteador usavam `\b` como fronteira de palavra. **O `\b`
do JavaScript é ASCII**: `\b[uú]ltim[oa]s?\b` casa "ultimas" e **não** casa
"últimas", porque o acento não é word char e o `\b` inicial exige um do lado.

Num app 100% pt-BR isso silenciaria metade das alternativas acentuadas de cada
lista, e a mensagem cairia no modo errado sem nenhum erro visível. As três
listas passaram a usar lookaround sobre `\p{L}`/`\p{N}` com a flag `u`, que
mantém a exigência de palavra inteira ("contratual" não casa "atual") e
funciona com acento. Há teste de regressão para os dois lados.

## Efeito esperado por mensagem

| Item | Antes | Depois |
|---|---|---|
| Pesquisa web | toda mensagem não-trivial | só modo `atualizado` |
| Contexto RAG | até ~10.800 chars | teto de 6.000, sem redundância |
| Histórico | até ~17.100 chars | teto de 8.000 |
| Latência do caminho comum | RAG + busca server-side | só RAG |

A economia real depende da distribuição de perguntas do escritório. O que dá
para medir depois do deploy, sem instrumentação nova: `uso_ia` já grava
`tokens_in`/`tokens_out` por mensagem, e a página `/app/uso` compara mês a mês.

## Ajuste fino

- Roteou errado para um tipo recorrente de pergunta? Acrescente o termo à lista
  certa em `lib/ia/roteador-contexto.ts` e um caso no `.test.ts`.
- Contexto curto demais? `SELECAO_PADRAO` em `lib/rag/selecao.ts`
  (`orcamentoChars`, `margemRelativa`, `sobreposicaoMaxima`).
- Conversas perdendo continuidade cedo demais? `ORCAMENTO_CHARS_HISTORICO`.

Todos são constantes puras com teste · nenhum exige tocar em pipeline.
