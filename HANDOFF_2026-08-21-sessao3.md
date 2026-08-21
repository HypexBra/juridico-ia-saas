# Handoff — sessão 2026-08-21 (sessão 3 — fixes de IA + conta de equipe + Fases 5/6)

Sessão rodou sem o usuário presente (autorização ampla dada previamente). Tudo commitado E pushado em `main`. HEAD atual: `b823f2f`. Ver `HANDOFF_2026-08-21.md` (sessão 1: pool multi-chave, Document Intelligence, Auditor de Peças) e `HANDOFF_2026-08-21-sessao1.md` (sessão 2: 4 fixes de bug de IA) para o histórico anterior. **Ver itens 9-11 deste arquivo para o que foi adicionado DEPOIS do resumo original desta sessão (Fases 5 e 6 completas) — itens 1-10 abaixo são o texto original, mantido para rastreabilidade.**

## TL;DR — leia isto primeiro

**O que foi corrigido/entregue** (tudo em produção, testado — 384 testes verdes, `tsc`/`next build` limpos em cada commit):
1. Bug do chat "IA indisponível, não troca de provider" — causa raiz real corrigida (item 1).
2. RAG sem recência + modelos desatualizados no RAG — corrigido (item 2).
3. Conta de equipe por escritório implementada de verdade (convite por e-mail) — resolve a causa do "parece que tá todo mundo junto" (item 4).
4. Bug antigo achado de quebra: link de "redefinir senha"/convite nunca levava a lugar nenhum (`/auth/callback` citado desde o início do projeto, nunca implementado) — corrigido (item 4).
5. Open redirect real em `/auth/callback` + hardening de RLS em `convites_equipe` — corrigido (item 4 / commit `6e9d157`).
6. **Fase 5 — Advogado do Contra**: feature nova completa (IA simula a parte adversária de uma tese), com guardrail anti-alucinação de jurisprudência (item 9).
7. **Fase 6 — Estrategista Jurídico**: feature nova completa (IA sintetiza teses/eventos/documentos do caso em estratégia acionável), embutida na ficha (item 10). No processo, achou e corrigiu um IDOR pré-existente em `criarTarefaCasoAction` (não introduzido por esta feature, mas exposto por ela).
8. Lista de tarefas no dashboard (item 8).
9. Dívida técnica fechada: upload validava só extensão/MIME, agora confere o conteúdo binário real (magic bytes) — item 11.
10. **Fase 7 (Pesquisa Jurídica Verificável)**: só pesquisa de viabilidade feita, NADA implementado ainda — ver item 10, subseção "Fase 7". Achado importante: grounding do Gemini sozinho NÃO é seguro pra citar jurisprudência (evidência de alucinação de citação mesmo com busca ativa) — próxima sessão precisa abrir o Portal de Dados Abertos do STJ e a API do DataJud/CNJ pra confirmar schema real antes de desenhar qualquer coisa.

**Ações manuais SUAS, pendentes** (nada disso eu consigo fazer remotamente):
- Rodar migrations `0037` a `0041` no Supabase (ordem e detalhe de cada uma no item 6).
- Supabase Dashboard → Authentication → URL Configuration → Redirect URLs: adicionar `https://SEU_DOMINIO/auth/callback` (item 4, ação 2) — sem isso o convite de equipe e a redefinição de senha quebram.
- Confirmar no Dashboard do Stripe que o webhook está registrado apontando pra `/api/webhooks/stripe` (item 5) — não consegui verificar isso remotamente.
- Testar ponta a ponta em produção: convite de equipe (item 4), Advogado do Contra (item 9), Estrategista (item 10).

**Próximo passo recomendado**: investigação técnica direta da Fase 7 (abrir `dadosabertos.web.stj.jus.br` e `datajud-wiki.cnj.jus.br/api-publica/exemplos/` de verdade, não só ler sobre eles) antes de qualquer ADR/arquitetura — ver item 10, subseção "Fase 7" pro roteiro completo.

## 1. Bug de IA "indisponível, não troca de provider" no CHAT — causa raiz real, corrigido

O usuário reportou que o bug já "corrigido" na sessão anterior (commit `ed376dd`) continuava acontecendo no chat. Investigação encontrou a causa raiz de verdade: o fix da sessão 2 só cobriu `lib/ia/chamada-estruturada.ts` (chamadas one-shot: Document Intelligence, análise de processo, auditor) — o **chat multi-turno** (`lib/ia/gemini.ts`) tinha a MESMA classe de bug, nunca corrigida: um erro 503 "UNAVAILABLE" (sobrecarga do modelo, não quota 429) esgotava as retentativas e propagava o erro cru, sem nunca chegar a trocar de modelo Gemini nem acionar o fallback cross-provider para Groq (`lib/ia/provider.ts` só reage a `QuotaExcedidaError`, que só era lançada para 429).

**Corrigido** (commit `391f3d1`): `gerarRespostaGemini` agora trata QUALQUER erro transiente (quota OU 5xx/rede) como gatilho pra trocar de modelo na cadeia e, se toda a cadeia esgotar, lança `QuotaExcedidaError` (aciona o Groq). 3 testes novos em `lib/ia/gemini.test.ts` (arquivo não existia antes). 317→320 testes verdes.

**Ação pendente sua:** nenhuma — já em produção.

## 2. RAG não priorizava informação recente + modelos ficavam desatualizados no RAG

Investigação (fork dedicado) mapeou o pipeline de RAG (`lib/rag/**`) e achou duas causas raiz concretas pro pedido "sempre pegar a informação mais recente":

- **Ranking era só similaridade pura** (`buscar_chunks_similares`, sem nenhum fator de recência) — um chunk desatualizado com texto parecido podia vencer um mais recente por distância marginalmente menor.
- **`atualizarModeloAction`/`criarModeloAction` nunca reindexavam** — só o botão manual "Reindexar dados internos" ou o write-back automático da IA (via chat) atualizavam o RAG. Editar um modelo de peça direto pela tela nunca atualizava o que a IA via. Mesmo gap existia em `criarFichaAction` (criação manual de ficha).

**Corrigido** (commit `f337129`):
- `supabase/migrations/0037_recencia_busca_chunks.sql` — boost exponencial pequeno por `criado_em` (meia-vida ~180 dias, só desempata candidatos já relevantes, nunca faz um chunk irrelevante furar o corte de distância).
- `app/app/modelos/actions.ts` e `app/app/fichas/actions.ts` — chamam `reindexarModelo`/`reindexarFichaCaso` (best-effort, nunca bloqueia o salvamento se o embedding falhar).

**Ação pendente sua:** rodar migration `0037` no Supabase.

**Não corrigido nesta sessão (documentado para o próximo ciclo de RAG)**, do relatório da investigação:
- Sem reranking (só ANN + corte de distância de cosseno) — com 6-12 candidatos, um passo de rerank (mesmo heurístico) melhoraria precisão.
- `reindexarMemoriaCaso` (memória incremental de IA por caso) é código morto, nunca chamado por nenhum fluxo — a IA não usa a memória acumulada do caso como contexto de RAG por similaridade hoje.
- Jurisprudência tem `data_julgamento` na metadata mas o ranking não usa essa data (só a recência de INDEXAÇÃO, `criado_em`) — decisão consciente desta sessão por risco de parse (`data_julgamento` como string em SQL puro sem tratamento de exceção); se quiser, dá pra fazer com uma função `plpgsql` com bloco `exception` em vez de `sql` puro.

## 3. Isolamento entre escritórios — investigado, NENHUM vazamento encontrado

Usuário suspeitou de vazamento de dados entre escritórios ("parece que tá todo mundo junto"). Investigação ponta a ponta (RLS de todas as tabelas sensíveis, RPC de busca vetorial, consulta pública por CPF do portal) não encontrou nenhum caminho de cross-tenant leak — toda tabela de negócio tem `escritorio_id not null` + RLS `escritorio_id = escritorio_atual()`, e a única exceção (`escritorio_id is null` na busca de embeddings) é jurisprudência pública por design.

**A causa real da sensação era outra**: convite de equipe nunca existia de fato (ver item 4). Cada pessoa que se cadastrava sozinha criava um escritório NOVO — o efeito é times **separados indevidamente**, não misturados.

## 4. Conta de equipe por escritório — implementado

Ver commit `36585fe` para o detalhe completo. Resumo: `convidarAction` agora envia convite de verdade via `auth.admin.inviteUserByEmail` (Supabase envia o e-mail, mesmo mecanismo já usado por `redefinirSenhaUsuarioAction`), grava em `convites_equipe` (migration `0038`), e no primeiro login o convidado é colocado DIRETO no escritório do convite (`lib/onboarding.ts#aceitarConviteEquipeSePendente`), nunca cria escritório novo.

**Bônus de segurança fechado**: `perfis_insert` antes só checava `auth_user_id = auth.uid()` — sem nenhuma restrição de `escritorio_id`/`role`, então QUALQUER usuário autenticado sem perfil podia se inserir como `owner` de QUALQUER escritório já existente (nunca explorado, mas sempre possível). Agora só passa criando o próprio escritório (primeiro/único perfil, `role=owner`) ou aceitando convite pendente/válido para o próprio e-mail.

**Bug pré-existente também corrigido de quebra**: `/auth/callback` era citado em `PUBLIC_PATHS` do middleware desde o início do projeto, mas a rota NUNCA foi implementada — nenhum link de e-mail do Supabase (nem o de convite novo, nem o de "redefinir senha" que já existia e era usado em produção) tinha pra onde voltar depois de trocar o `code` por sessão. Ou seja: **o botão "Redefinir senha" do admin enviava o e-mail, mas o link nunca deixava o usuário definir senha nova de fato** — bug antigo, só descoberto agora porque toquei no mesmo mecanismo pro convite. Criadas `app/auth/callback/route.ts` e `app/auth/definir-senha/page.tsx`.

**Ações pendentes SUAS:**
1. Rodar migration `0038` no Supabase.
2. **No Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**, adicionar `https://SEU_DOMINIO/auth/callback` (troque pelo domínio real de produção). Sem isso, o Supabase rejeita o `redirectTo` que o código está passando e o e-mail de convite/redefinição de senha volta pra URL default (provavelmente quebrado). **Isso é manual — não tenho acesso ao painel do Supabase para configurar isso remotamente.**
3. Teste ponta a ponta: convidar alguém em `/app/equipe`, abrir o e-mail recebido, definir senha, confirmar que a pessoa cai no MESMO escritório com o papel escolhido. Depois testar "Redefinir senha" em `/admin/usuarios` do mesmo jeito.
4. Decisões que ficaram de fora do escopo (baixo risco, dá pra fazer depois): teto de nº de membros por plano Free/Pro (não existe hoje); impedir que alguém com convite pendente se autocadastre criando escritório próprio em vez de aceitar o convite (hoje: `inviteUserByEmail` já cria a conta no Auth imediatamente, então um auto-cadastro com o mesmo e-mail vai falhar com "já existe uma conta" — cobre o caso principal, mas não indica ativamente "você tem um convite pendente, aceite-o" na tela de cadastro).

## 5. Stripe → upgrade automático pra Pro — verificado, já está correto

Conferido: `app/api/webhooks/stripe/route.ts` grava `escritorios.plano = 'pro'` automaticamente no evento `checkout.session.completed`, e reverte para `free` em `customer.subscription.deleted`/status terminal. As 4 env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO_MENSAL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) já estão configuradas na Vercel (produção). **Não consigo confirmar remotamente** se o endpoint do webhook está de fato registrado no Dashboard do Stripe apontando pra essa rota com o mesmo signing secret — não tenho acesso ao painel do Stripe nem ao Supabase management API nesta sessão (`vercel env pull` foi bloqueado pelo classificador de permissão do Claude Code por puxar secrets pro disco). **Ação sua**: confirmar no Dashboard do Stripe → Developers → Webhooks que existe um endpoint `https://SEU_DOMINIO/api/webhooks/stripe` escutando `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

## 6. Migrations pendentes (rodar no Supabase, em ordem)

Confirme quais já rodaram — não tenho acesso direto ao banco nesta sessão:
- `0033`–`0036` (sessões anteriores, Document Intelligence/Auditor/fix varchar Autentique) — se ainda não rodaram, ver handoffs anteriores.
- `0037_recencia_busca_chunks.sql` (recência no RAG).
- `0038_convites_equipe.sql` (conta de equipe, inclui RLS mais restritiva em `perfis_insert`).
- `0039_advogado_contra.sql` (Fase 5, tabela `analises_advogado_contra`).
- `0040_convites_equipe_hardening.sql` (trigger de imutabilidade em `convites_equipe`, achado de revisão de segurança).

## 7. Chat cliente → advogado — já existe, não é gap

Verificado: `app/portal/mensagens/actions.ts` + `app/app/fichas/[id]/mensagens-actions.ts` já implementam um chat bidirecional cliente↔escritório dentro da ficha (feature Pro `portal_cliente_rico`). Não é um item pendente do pedido do usuário.

## 8. Dashboard — lista de tarefas (Fase 19 do prompt mestre) — IMPLEMENTADO nesta sessão (texto original abaixo, mantido como histórico)

~~Confirmado: `app/app/dashboard/page.tsx` (383 linhas) já mostra "Próximos prazos" (`prazos`), mas nunca lê `caso_tarefas` (Fase 1, migration `0027`) — o dashboard de verdade não mostra uma lista de TAREFAS, só prazos. É o gap concreto por trás do "lembra das melhorias no dashboard, como a lista de tarefas".~~

**Feito** (commit `0dc5d32`, antes das Fases 5/6): card "Minhas tarefas" novo em `/app/dashboard` (`components/app/tarefa-dashboard-item.tsx`), lendo `tarefas_caso` (nome real da tabela — o texto original acima citou `caso_tarefas` por engano) com `status != 'concluida'`, filtrado por responsável (ou sem responsável = visível a todos), com botão "Concluir" chamando a mesma `atualizarStatusTarefaCasoAction` já usada na ficha. Isso cobre o pedido original; o resto da Fase 19 (seções ATENÇÃO/PRODUTIVIDADE/FINANCEIRO redesenhadas) continua não iniciado.

## 9. Fase 5 — Advogado do Contra — IMPLEMENTADA E REVISADA nesta sessão

Depois do handoff original desta sessão ter sido escrito (o texto abaixo é histórico, mantido para rastreabilidade), a sessão continuou e completou a Fase 5 inteira em 3 ondas + revisão, todas commitadas e pushadas:

- **Onda 0 (database)**, commit `0dc5d32`: `supabase/migrations/0039_advogado_contra.sql` (tabela `analises_advogado_contra`, 3 origens: colado/upload/tese_cadastrada), `lib/planos/gating.ts` (11ª feature `advogado_do_contra`), `lib/ia/limite-concorrencia.ts` (5ª tabela no gate).
- **Onda 1 (ai-engineer)**, commit `7360b62`: `lib/advogado-contra/{tipos,prompt,analisar}.ts` + testes — achados adversariais qualitativos (sem notas 0-10), guardrail crítico anti-alucinação de "precedentes contrários prováveis" (regex CNJ em `.refine()` fail-closed + prompt reforçado), guardrail de lastro para `vulnerabilidadeGeral: "alta"`.
- **Onda 2 (senior-engineer)**, commit `86bc778`: `app/app/advogado-contra/**`, `components/app/advogado-contra-{form,resultado}.tsx`, nav na sidebar, atalho "Testar tese contra" na ficha.
- **Onda 3 (revisão paralela — security + qa + tech lead)**: nenhum achado crítico/alto/médio/bloqueante. Um achado baixo já conhecido (regex CNJ não cobre variantes tipo "Súmula 123"/"REsp 1.234.567" sem pontuação — mitigado por instrução de prompt explícita citando esses exemplos). ADR retroativo `docs/adrs/0013-advogado-do-contra.md` (commit `c671c62`).

**Decisão de produto em aberto, sinalizada pelo tech lead** (não decidida, não aplicada): o Auditor de Peças (`/app/auditor`) tem o formulário INLINE na página de listagem; o Advogado do Contra (`/app/advogado-contra`) tem o formulário numa rota separada (`/app/advogado-contra/novo`), seguindo literalmente o que o próprio ADR 0012 especificava para o Auditor — mas o Auditor já em produção nunca seguiu esse ponto do seu próprio ADR. Ou seja: divergência de UX real entre as duas features irmãs, mas não é claro qual lado "corrigir" (mudar o Auditor afeta usuários reais; mudar o Advogado do Contra é mais barato por ser novo). Fica pra você decidir.

**Lacunas de teste não-bloqueantes** (reportadas pelo QA, nenhuma é bug): boundary exato de `TAMANHO_MAXIMO_TESE_ADVOGADO_CONTRA` sem teste automatizado (comportamento manualmente verificado como correto), combinação de todos os arrays opcionais vazios simultaneamente sem teste combinatório.

**Ação pendente sua**: rodar migration `0039` (e `0040`, ver item 6) no Supabase; testar o fluxo ponta a ponta em produção (colar tese, upload, selecionar tese cadastrada, conferir que o aviso de "hipótese da IA" aparece destacado na seção de precedentes).

### Prompt mestre de 29 fases (Ciclos 1-7) — estado no fim desta sessão (ver item 10 abaixo)

Este trecho ficou desatualizado assim que foi escrito — a sessão continuou e completou a Fase 6 também. Ver item 10 para o estado real final.

## 10. Fase 6 — Estrategista Jurídico — IMPLEMENTADA E REVISADA (depois do item 9 ter sido escrito) + achado de segurança pré-existente corrigido

Continuação da sessão depois do item 9: **ADR + 3 ondas + revisão paralela, tudo completo**, seguindo o mesmo processo da Fase 5.

- **ADR** `docs/adrs/0014-estrategista-caso.md` (commit `998d450`, via agente `architect`) — decisão mais importante: esta feature é a primeira "agregadora" do produto (lê `fichas_caso`+`teses_caso`+`eventos_caso`+`pessoas_caso`+`caso_jurisprudencia_citada`+resumos de `analises_processo`/`analises_documento`, em vez de analisar um texto avulso como as 5 features anteriores) — por isso é **embutida em `/app/fichas/[id]`, sem rota standalone e sem item de sidebar** (divergência deliberada do padrão Auditor/Advogado do Contra, justificada porque "estratégia sem caso" não existe como conceito de produto).
- **Onda 0 (database)**, commit `f9bb23c`: `supabase/migrations/0041_estrategia_caso.sql` (tabela `estrategias_caso`, `ficha_caso_id` NOT NULL — única tabela de resultado de IA do projeto sem uso standalone), 12ª feature `estrategista_caso`, 6ª tabela no gate de concorrência.
- **Onda 1 (ai-engineer)**, commit `a65096a`: `lib/estrategia-caso/{tipos,contexto,prompt,gerar}.ts` — `montarContextoEstrategiaCaso` é função pura (sem I/O) que prioriza/corta o contexto por seção inteira ao atingir 120k caracteres; guardrail fail-closed contra `teseCasoId` alucinado.
- **Onda 2 (senior-engineer)**, commit `6e7842a`: `app/app/fichas/[id]/estrategia-actions.ts` (busca as 6 fontes em paralelo com `Promise.all`) + nova aba "Estratégia" na ficha + botões "Cadastrar como tese"/"Criar tarefa" reusando actions já existentes (zero escrita nova).
- **Onda 3 (revisão paralela)** + fixes aplicados no mesmo commit `a215914`:
  - **Achado MEDIUM, pré-existente (não introduzido por esta feature, mas exposto por ela)**: `criarTarefaCasoAction` (`app/app/fichas/[id]/tarefas-actions.ts`) inseria uma tarefa com `escritorio_id` da PRÓPRIA sessão mas `ficha_caso_id` vindo de parâmetro sem checar que a ficha pertence a esse escritório — um usuário que descobrisse o `fichaCasoId` de outro tenant podia, chamando a action diretamente (fora da UI), inserir uma tarefa cruzando dados de dois escritórios. **Corrigido**: checagem explícita de ownership antes do insert.
  - 2 guardrails LOW adicionados em `lib/estrategia-caso/prompt.ts`: (1) rejeita a mesma tese cadastrada aparecendo como principal E subsidiária ao mesmo tempo; (2) guardrail anti-alucinação de id, antes só para `teseCasoId`, estendido para `eventoCasoId`/`analiseDocumentoId`/`analiseProcessoId` (defesa em profundidade — a UI não dereferencia esses ids hoje, mas fecha a lacuna antes que uma UI futura precise).
  - Typo cosmético corrigido (`jaViroutarefa` → `jaVirouTarefa`).
  - 374 testes verdes ao final (372 + 2 novos cobrindo os guardrails), `tsc`/`next build` limpos.

**Ação pendente sua**: rodar migration `0041` no Supabase; testar ponta a ponta na ficha de um caso (gerar estratégia, cadastrar uma tese sugerida, criar uma tarefa a partir de um próximo passo).

### Estado real por Ciclo, ao FIM desta sessão

- **Ciclo 1 (Core Jurídico)**: Fases 0-3 completas.
- **Ciclo 2 (IA Jurídica)**: Fases 4, 5 e **6 completas**. **Só falta a Fase 7 (Pesquisa Jurídica Verificável)** pra fechar o ciclo inteiro.
- **Ciclos 3-7**: nenhuma fase iniciada.

### Fase 7 — Pesquisa Jurídica Verificável — pesquisa de viabilidade FEITA nesta sessão, implementação NÃO iniciada

Investigado (agente `researcher` com `WebSearch`, ~15 buscas) antes de desenhar qualquer arquitetura — resultado completo abaixo, pra próxima sessão não repetir a pesquisa:

**O que existe hoje no projeto**: `lib/rag/jurisprudencia.ts` é só um helper de ingestão MANUAL/admin de jurisprudência pro RAG compartilhado (migration `0008`) — não é busca ao vivo. `lib/ia/gemini.ts` liga `googleSearch` (grounding nativo do Gemini) sempre que tools estão permitidas no chat — é a única "pesquisa ao vivo" que existe, mas é uma ferramenta do CHAT, não uma feature dedicada com fonte estruturada.

**Achados da pesquisa** (fontes citadas no relatório completo do agente, não repetidas aqui por brevidade):
1. **STF**: não tem API pública de busca de jurisprudência — só o portal de busca web (`jurisprudencia.stf.jus.br`), pra humanos.
2. **STJ**: tem um **Portal de Dados Abertos** (`dadosabertos.web.stj.jus.br`, formato CKAN) com dataset de jurisprudência que segundo o próprio STJ inclui **texto integral** de decisões do DJe — a pista mais promissora encontrada, mas **ninguém abriu o dataset ainda pra confirmar os campos exatos** (relator/número/data/link linha a linha).
3. **CNJ/DataJud**: tem API pública oficial (`api-publica.datajud.cnj.jus.br`) cobrindo TODOS os tribunais, mas é API de **metadados processuais e movimentação**, não de conteúdo de acórdão/ementa — útil talvez só como camada de "isso é um processo real?" (checagem de existência), não como fonte de conteúdo citável. Schema JSON exato não foi confirmado (o agente não conseguiu abrir `/exemplos/` do wiki do CNJ).
4. **Serviços comerciais** (Escavador, JusBrasil, Predictus): todos reais, com produtos reais, mas parecem focados em CONSULTA PROCESSUAL POR NÚMERO (compliance/due diligence), não em BUSCA TEMÁTICA de jurisprudência — não confirmado se algum resolve o caso de uso real ("buscar por tema X e receber acórdãos relevantes"). Escavador bloqueou acesso à página de preços (403); nenhum tem free tier claramente documentado.
5. **Grounding do Gemini como fonte única — DESACONSELHADO com evidência concreta**: há relatos no fórum oficial da Google AI ("hallucinated URLs with grounding", 2026) e múltiplos papers acadêmicos recentes (arXiv, ainda não peer-reviewed) mostrando que LLMs **continuam fabricando citações jurídicas mesmo com grounding/busca ativada** — inclusive casos REAIS de escritórios de advocacia americanos punidos judicialmente por citação alucinada gerada por IA (incluindo Gemini), noticiado por fonte especializada em legaltech (LawNext, 2025). Isso é exatamente o risco que a regra de produto deste projeto ("nunca inventar jurisprudência") existe pra evitar — usar só grounding sem uma camada de verificação é incompatível com essa regra.

**Recomendação do research pra próxima sessão** (não decidida, não implementada):
1. Abrir de fato `dadosabertos.web.stj.jus.br` (dataset de jurisprudência) e `datajud-wiki.cnj.jus.br/api-publica/exemplos/` — são as duas pontas soltas mais importantes, ninguém confirmou o schema real ainda.
2. Verificar `robots.txt`/ToS de `jurisprudencia.stf.jus.br` e `stj.jus.br` antes de cogitar scraping como plano B pro STF (que não tem nem API nem dados abertos confirmados).
3. Se a arquitetura final incluir grounding do Gemini de alguma forma, adicionar uma camada de verificação em runtime (confirmar programaticamente que o link citado resolve pra um recurso real e contém o número de processo citado) ANTES de exibir ao usuário como fonte — nunca confiar só na saída do modelo.
4. Cobertura parcial e HONESTA (ex.: só STF+STJ, ou só STJ se for a única fonte confirmada) é mais defensável que fingir cobertura nacional via scraping frágil.

Só depois dessas 2-3 verificações técnicas diretas (abrir os dados reais, não só a documentação) é que faz sentido escrever um ADR de arquitetura — diferente das Fases 5/6, aqui a viabilidade técnica não estava clara a partir só do código/documentação existente.

## 11. Dívida técnica fechada nesta sessão: upload validava só extensão/MIME, nunca conteúdo binário real

Registrada desde a sessão 1 (Fase 3) como dívida aceita, transversal a 4 features (análise de processo, Document Intelligence, Auditor de Peças, Advogado do Contra) — cada uma com sua própria cópia de `inferirTipoArquivo*`/`MIME_POR_TIPO_*` (achado repetido pelo tech lead nas revisões da Fase 5 e 6). **Corrigido** (commit `c3ba3ec`): `lib/uploads/validacao.ts` unifica a inferência de tipo (mesma lógica, sem duplicação) e adiciona `bufferBateComAssinatura` — confere os magic bytes reais do arquivo (`%PDF-`, assinatura ZIP `PK\x03\x04` pra DOCX, JPEG/PNG/WEBP por assinatura) contra o tipo declarado, ANTES de gastar upload+chamada de IA num arquivo renomeado/forjado. Aplicado nos 4 pontos de upload. Não é sanitização completa (não valida estrutura interna do ZIP/PDF), só fecha o caso mais barato de burlar. 384 testes verdes ao final (374 + 10 novos), `tsc`/`next build` limpos.

## 12. Notas de processo desta sessão (consolidado)

- Sem acesso a MCP do Supabase/Stripe nesta sessão (`ToolSearch` não achou nenhuma ferramenta correspondente) — toda verificação de config/migration foi por leitura de código + `vercel env ls` (só lista nomes/datas, não valores). `vercel env pull` foi bloqueado pelo classificador de permissão do ambiente (puxaria secrets pro disco) — não insisti, é uma barreira de segurança do harness, não um erro.
- `npm install` rodado (deps opcionais faltando localmente — `mammoth`, `@langchain/core` — impediam 5 suítes de teste de rodar; resolvido, sem mudança de versão de nada, só instalação do que já estava no `package-lock.json`/`package.json`).
- Bug real encontrado e corrigido durante a sessão: `npx next build` local quebrava em `/auth/definir-senha` (client component pré-renderizado estaticamente tentando instanciar o client do Supabase) — corrigido com `export const dynamic = "force-dynamic"` (commit `b0afeeb`).
- Todo código novo tem teste e passou por `tsc --noEmit` + suíte completa + `next build` antes de cada commit. Suíte terminou esta sessão em 350 testes verdes (começou em 317).
- Fase 5 foi construída via ondas de subagentes (`database`→`ai-engineer`→`senior-engineer`→revisão paralela `security`+`qa`+`general-purpose`), cada uma verificada por mim (tsc+vitest, e nas duas últimas também `next build`) antes do commit — nenhum relatório de agente foi aceito sem confirmação própria.
