# 0013 — Advogado do Contra (Fase 5)

## Status

Implementado (2026-08-21) — commits `0dc5d32` (Onda 0, `database`), `7360b62` (Onda 1,
`ai-engineer`), `86bc778` (Onda 2, `senior-engineer`). ADR escrito retroativamente após as 3
ondas (instrução das ondas anteriores classificava o ADR como opcional/não-bloqueante); este
documento registra as decisões efetivamente tomadas no código, não um design prévio.

## Contexto

Ciclo 1 (Fases 0-4) já inclui o Auditor de Peças (ADR 0012, `lib/auditoria-peca/**`,
`auditorias_peca`): a IA avalia uma peça já redigida e devolve notas 0-10 por dimensão mais um
veredito de risco categórico. A Fase 5 pede uma capacidade complementar, não uma variação do
Auditor: a IA assume a perspectiva da parte **adversária** de uma tese, petição ou argumento
jurídico e ataca essa tese — argumentos contrários, fragilidades exploráveis, contradições
internas, hipóteses de precedente contrário, pontos sem prova, perguntas difíceis de um julgador
e recomendações de reforço — para o próprio advogado testar a força da estratégia antes de
protocolar. Nunca redige nada e nunca defende a tese.

O Auditor de Peças é o precedente direto e a feature foi construída deliberadamente para
espelhar sua arquitetura: mesma união discriminada de entrada, mesmo `gerarRespostaEstruturada`
(chamada one-shot com retry/fallback via `lib/ia/chamada-estruturada.ts`), mesmo parser Zod
fail-closed, mesmo gate de plano Pro + gate de concorrência por escritório, mesmo ciclo de status
`processando`/`pronto`/`erro`. Divergências do padrão do Auditor só onde o domínio adversarial
exige — nunca por acidente.

## Decisão

### 1. Schema — nova tabela `analises_advogado_contra`, com um 3º modo de entrada que o Auditor não tem

`supabase/migrations/0039_advogado_contra.sql` segue exatamente a forma de `auditorias_peca`
(migration 0035): `escritorio_id`/`ficha_caso_id` (nullable, mesmo precedente — rodar a análise
antes de vincular a uma ficha aberta é fluxo válido), `origem`/`titulo`/colunas condicionais de
`colado`/`upload`, `status`, `resultado_advogado_contra jsonb`, `modelo_ia_usado`, `erro`,
timestamps, RLS por `escritorio_atual()`.

Duas diferenças deliberadas, não acidentais:

- **`tese_caso_id uuid references teses_caso(id) on delete set null`** — coluna nova, porque a
  entrada pode ser uma tese já cadastrada em `teses_caso` (Fase 1, migration 0025), não só texto
  colado ou upload. `on delete set null`: apagar a tese não apaga a análise já gerada, mesmo
  racional de `ficha_caso_id`.
- **`origem varchar(20)`** em vez do `varchar(10)` do Auditor — o 3º valor (`tese_cadastrada`,
  15 caracteres) não cabe em 10; a constraint `analises_advogado_contra_origem_consistente` cobre
  3 ramos em vez de 2, incluindo o caso `tese_cadastrada` (exige `tese_caso_id` preenchido e
  todas as demais colunas condicionais nulas).

A coluna de resultado tem nome/schema próprios (`resultado_advogado_contra`, não reuso de
`resultado_auditoria`) porque o shape é estruturalmente diferente: sem notas numéricas em nenhum
campo, só achados adversariais qualitativos e um veredito categórico final de vulnerabilidade.

### 2. Entrada — 3 modos via união discriminada, um único módulo `lib/advogado-contra/analisar.ts`

`ParametrosAnalisarComoAdvogadoContra` é a união discriminada de `auditarPeca` mais um 3º ramo:

```ts
export type ParametrosAnalisarComoAdvogadoContra =
  | { origem: "colado"; titulo: string | null; texto: string }
  | { origem: "upload"; titulo: string | null; buffer: Buffer; tipoArquivo: TipoArquivoAdvogadoContra; nomeArquivo: string }
  | { origem: "tese_cadastrada"; tese: string; fundamentacao: string | null };
```

`colado`/`upload` reaproveitam sem alteração `lib/analise-processo/extracao.ts`
(`extrairTextoDePdfPorPagina`, `extrairTextoDeDocx`, `truncarTextoExtraido`) e
`gerarRespostaEstruturada`, exatamente como `auditarPeca`. `tese_cadastrada` é o ramo novo: sem
upload nem extração — o prompt é montado direto a partir de `teses_caso.tese`/
`teses_caso.fundamentacao`, já validados pela Fase 1, por isso não passa pelo piso/teto de
tamanho de texto (`TAMANHO_MINIMO_TESE_ADVOGADO_CONTRA`/`TAMANHO_MAXIMO_TESE_ADVOGADO_CONTRA`)
que os outros dois ramos respeitam.

`analisarTeseCadastradaAction` (`app/app/advogado-contra/actions.ts`) resolve
`ficha_caso_id`/`tese_caso_id` direto da tese buscada, sem receber `fichaCasoId` como parâmetro
separado como os outros dois ramos — toda tese pertence a uma ficha (`teses_caso.ficha_caso_id`
não é nulo), então o vínculo é automático e nunca há risco de a análise apontar para uma ficha
diferente da dona da tese.

### 3. Schema do resultado — `ResultadoAdvogadoContra`, sem nenhuma nota numérica

`lib/advogado-contra/tipos.ts` reaproveita `CitacaoAnaliseProcesso`/`NivelCertezaAnaliseProcesso`
de `lib/analise-processo/tipos.ts` (ADR 0004), mesmo contrato de rastreabilidade
(`trechoOriginal`/`pagina`/`certeza`) usado por Document Intelligence (ADR 0011) e Auditor de
Peças (ADR 0012) — 4ª feature a reaproveitar o mesmo formato, não redefinido.

Diferença estrutural central em relação ao Auditor: **nenhum campo numérico**. Onde o Auditor tem
`notas: NotasAuditoriaPeca` (4 dimensões 0-10) mais `veredictoRisco` categórico separado, o
Advogado do Contra tem só `vulnerabilidadeGeral: "baixa" | "media" | "alta"` +
`justificativaVulnerabilidade` — o mesmo espírito de "veredito categórico com justificativa
obrigatória", sem o componente de pontuação agregada (o domínio é 100% achado qualitativo).

Tipos próprios sem equivalente no Auditor:

- `ArgumentoContrario` — o que a parte adversária diria contra a tese (citável).
- `Fragilidade` — ponto fraco NA PRÓPRIA tese que o adversário poderia explorar (citável,
  categoria própria: `fundamentacao`/`fatos`/`provas`/`pedidos`/`argumentacao`/
  `inconsistencia`/`clareza`/`estrutura` — 8 categorias, distintas das 11 do Auditor porque o
  domínio é mais estreito: fragilidade de tese, não auditoria de peça inteira).
- `Contradicao` — inconsistência interna (citável, sem categoria/severidade próprias).
- `PrecedenteContrarioProvavel` — **propositalmente NÃO estende `CitacaoAnaliseProcesso`**: é
  hipótese sobre entendimento jurisprudencial/doutrinário externo ao texto fornecido, não uma
  citação extraída dele, então fingir rastreabilidade a uma página que não existe seria pior do
  que omitir esses campos.
- `pontosQueExigemProva`/`perguntasDificeis`/`recomendacoesFortalecimento` — strings livres sem
  citação, mesmo padrão de `omissoesDetectadas` do Auditor.

### 4. Prompt/guardrail — guarda anti-alucinação de precedente REFORÇADA em relação ao Auditor

`lib/advogado-contra/prompt.ts` segue a mesma estrutura de `lib/auditoria-peca/prompt.ts`
(persona restrita, JSON estruturado, texto tratado como DADO nunca instrução, guarda de prompt
injection), com um bloco de guarda deliberadamente MAIS FORTE e mais repetitivo que o do Auditor,
específico de `precedentesContrariosProvaveis`: é a parte mais perigosa da feature (a IA é
tentada a "completar" jurisprudência que parece real mas é inventada), e é reforçada por um
guardrail em CÓDIGO que o Auditor não precisa — `REGEX_NUMERO_PROCESSO_CNJ` (formato
`NNNNNNN-DD.AAAA.J.TR.OOOO`) rejeita, via `.refine()` do Zod, qualquer `descricao` de precedente
que contenha um número de processo no padrão CNJ. Não tenta detectar todo tipo de citação
inventada (nome de relator, súmula, data por extenso escapariam de qualquer regex), mas é uma
bandeira vermelha barata e inequívoca de checar em código, não deixada só como instrução ao
modelo.

Guardrail de "achado sem lastro" adaptado do padrão de humildade epistêmica do Auditor (ADR 0012,
seção 4, item 2), mas **assimétrico por design**: `vulnerabilidadeGeral === "alta"` exige pelo
menos 1 fragilidade "grave", 1 contradição ou 1 argumento contrário "alta" força que a sustente
— sem equivalente para "baixa". O Auditor exige lastro nos dois extremos (nota muito baixa E nota
muito alta) porque uma nota é sempre uma afirmação forte em ambas as direções; aqui
"vulnerabilidade baixa" é o resultado natural de uma tese bem fundamentada sem achado grave, e
exigir um "achado que prove a solidez" forçaria a IA a inventar elogios específicos sem função de
guardrail real — não há risco de alucinação simétrico entre "sem problemas" e "muito vulnerável".

### 5. UI — duas rotas (`/app/advogado-contra` + `/app/advogado-contra/novo`), diferente da rota única do Auditor

`app/app/advogado-contra/page.tsx` (lista + atalho "Nova análise") e
`app/app/advogado-contra/novo/page.tsx` (formulário, aceita `?fichaId=`) são duas rotas
separadas. Isso diverge do Auditor de Peças em produção, onde `/app/auditor` combina lista E
formulário numa página só (sem rota `/novo`) — apesar do próprio ADR 0012, seção 6, ter
originalmente especificado `/app/auditor/novo` como rota distinta; a implementação do Auditor
não seguiu esse ponto do seu próprio ADR.

Registrado aqui como **divergência aceita, não corrigida nesta Fase**: o Advogado do Contra segue
o texto do ADR 0012 à risca (lista e formulário em rotas separadas), o que é internamente
consistente, mas produz uma UX ligeiramente inconsistente entre as duas features irmãs (o atalho
"Auditar peça" na ficha do caso linka para `/app/auditor?fichaId=`, enquanto "Testar tese contra"
linka para `/app/advogado-contra/novo?fichaId=`). Unificar os dois padrões (ambos numa rota só,
ou ambos em duas) é dívida de UX de baixo risco, não bloqueante — ver seção Consequências.

Nav item próprio na sidebar (`components/app/sidebar.tsx`), ícone `advogadoContra` dedicado,
mesmo racional do Auditor: nem toda tese a testar pertence a uma ficha aberta.

Tela de resultado (`components/app/advogado-contra-resultado.tsx`) tem **dois** avisos fixos
sempre visíveis (o Auditor tem um só): o aviso geral de "simulação da IA, não citação verificada"
e um segundo, com estilo visualmente mais forte (borda vermelha em vez de âmbar), isolando
`precedentesContrariosProvaveis` em bloco próprio — requisito funcional decorrente do guardrail
anti-alucinação da seção 4, não polimento visual.

### 6. Gating e concorrência

`lib/planos/gating.ts`: `advogado_do_contra` é a 11ª chave em `FEATURES_PREMIUM`, Pro-only sem
tier gratuito parcial, mesmo padrão das 10 features anteriores de análise estruturada por IA.

`lib/ia/limite-concorrencia.ts`: `TABELAS_PROCESSAMENTO_IA` ganha `analises_advogado_contra`
como 5ª tabela verificada por `existeProcessamentoIaEmAndamento` — o gate de concorrência por
escritório (nenhuma combinação de features pesadas pode rodar ao mesmo tempo para o mesmo
tenant) já existia generalizado desde o Auditor de Peças; esta Fase só soma mais uma tabela à
lista, sem mudar o mecanismo.

## Consequências

**Positivas**

- Zero duplicação de extração de texto, retry/fallback de IA ou parser fail-closed — 5ª feature
  a reaproveitar `lib/ia/chamada-estruturada.ts`, 4ª a reaproveitar `CitacaoAnaliseProcesso`.
- Guardrail em código (regex CNJ) fecha a lacuna mais perigosa de alucinação da feature sem
  depender só de instrução de prompt.
- 350+ testes verdes (`lib/advogado-contra/{analisar,prompt}.test.ts` cobrindo os 3 modos de
  entrada, resposta fora do schema, e o guardrail de `vulnerabilidadeGeral: "alta"` sem lastro),
  `tsc --noEmit` limpo.

**Negativas**

- 6ª tabela de "resultado de análise de IA sobre documento/peça/tese" no projeto
  (`analises_risco_contratual`, `analises_documento`, `comparacoes_documento`,
  `analises_processo`, `auditorias_peca`, agora `analises_advogado_contra`) — mesma dívida de
  sobreposição conceitual já aceita no ADR 0011/0012 (consulta "todas as análises de IA deste
  escritório" exigiria UNION de 6 tabelas).
- Inconsistência de padrão de UI entre `/app/auditor` (rota única) e `/app/advogado-contra` +
  `/app/advogado-contra/novo` (duas rotas) — seção 5. Não bloqueante (nenhum dos dois padrões é
  incorreto isoladamente), mas é a divergência mais visível para o próximo dev que mexer em
  qualquer uma das duas features esperando o padrão da outra. Registrada aqui em vez de corrigida
  silenciosamente numa das duas, para que a decisão de unificar (e em qual direção) seja
  deliberada, não incidental.
- Sem tier gratuito parcial — mesma decisão comercial já aceita nas 10 features anteriores.

## Arquivos lidos para este ADR

`supabase/migrations/0039_advogado_contra.sql`, `supabase/migrations/0035_auditorias_peca.sql`,
`lib/advogado-contra/{tipos,prompt,analisar}.ts` e respectivos `.test.ts`,
`lib/auditoria-peca/{tipos,prompt,auditar}.ts`, `app/app/advogado-contra/**`,
`app/app/auditor/**`, `components/app/advogado-contra-{form,resultado}.tsx`,
`components/app/auditor-{form,resultado}.tsx`, `lib/planos/gating.ts`,
`lib/ia/limite-concorrencia.ts`, `components/app/sidebar.tsx`,
`app/app/fichas/[id]/page.tsx`, `lib/types.ts`, `docs/adrs/0012-auditor-de-pecas.md`.
