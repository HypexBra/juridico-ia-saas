# Handoff — sessão 2026-08-21 (sessão 3 — fixes de IA + conta de equipe)

Sessão rodou sem o usuário presente (autorização ampla dada previamente). Tudo commitado E pushado em `main`. HEAD atual: `36585fe`. Ver `HANDOFF_2026-08-21.md` (sessão 1: pool multi-chave, Document Intelligence, Auditor de Peças) e `HANDOFF_2026-08-21-sessao1.md` (sessão 2: 4 fixes de bug de IA) para o histórico anterior.

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

## 8. Dashboard — lista de tarefas (Fase 19 do prompt mestre) — NÃO iniciado

Confirmado: `app/app/dashboard/page.tsx` (383 linhas) já mostra "Próximos prazos" (`prazos`), mas nunca lê `caso_tarefas` (Fase 1, migration `0027`) — o dashboard de verdade não mostra uma lista de TAREFAS, só prazos. É o gap concreto por trás do "lembra das melhorias no dashboard, como a lista de tarefas".

Próximo passo recomendado (não implementado, é escopo novo): seção "Hoje" no dashboard juntando prazos vencendo + tarefas de `caso_tarefas` com `concluida = false` e `data_limite` próxima, ordenados por urgência — visualmente igual ao card "Próximos prazos" já existente, reusando o mesmo componente de lista se possível. Isso também é o começo da Fase 19 ("HOJE / ATENÇÃO / PRODUTIVIDADE / FINANCEIRO") do prompt mestre do usuário.

## 9. Fase 5 — Advogado do Contra — IMPLEMENTADA E REVISADA nesta sessão

Depois do handoff original desta sessão ter sido escrito (o texto abaixo é histórico, mantido para rastreabilidade), a sessão continuou e completou a Fase 5 inteira em 3 ondas + revisão, todas commitadas e pushadas:

- **Onda 0 (database)**, commit `0dc5d32`: `supabase/migrations/0039_advogado_contra.sql` (tabela `analises_advogado_contra`, 3 origens: colado/upload/tese_cadastrada), `lib/planos/gating.ts` (11ª feature `advogado_do_contra`), `lib/ia/limite-concorrencia.ts` (5ª tabela no gate).
- **Onda 1 (ai-engineer)**, commit `7360b62`: `lib/advogado-contra/{tipos,prompt,analisar}.ts` + testes — achados adversariais qualitativos (sem notas 0-10), guardrail crítico anti-alucinação de "precedentes contrários prováveis" (regex CNJ em `.refine()` fail-closed + prompt reforçado), guardrail de lastro para `vulnerabilidadeGeral: "alta"`.
- **Onda 2 (senior-engineer)**, commit `86bc778`: `app/app/advogado-contra/**`, `components/app/advogado-contra-{form,resultado}.tsx`, nav na sidebar, atalho "Testar tese contra" na ficha.
- **Onda 3 (revisão paralela — security + qa + tech lead)**: nenhum achado crítico/alto/médio/bloqueante. Um achado baixo já conhecido (regex CNJ não cobre variantes tipo "Súmula 123"/"REsp 1.234.567" sem pontuação — mitigado por instrução de prompt explícita citando esses exemplos). ADR retroativo `docs/adrs/0013-advogado-do-contra.md` (commit `c671c62`).

**Decisão de produto em aberto, sinalizada pelo tech lead** (não decidida, não aplicada): o Auditor de Peças (`/app/auditor`) tem o formulário INLINE na página de listagem; o Advogado do Contra (`/app/advogado-contra`) tem o formulário numa rota separada (`/app/advogado-contra/novo`), seguindo literalmente o que o próprio ADR 0012 especificava para o Auditor — mas o Auditor já em produção nunca seguiu esse ponto do seu próprio ADR. Ou seja: divergência de UX real entre as duas features irmãs, mas não é claro qual lado "corrigir" (mudar o Auditor afeta usuários reais; mudar o Advogado do Contra é mais barato por ser novo). Fica pra você decidir.

**Lacunas de teste não-bloqueantes** (reportadas pelo QA, nenhuma é bug): boundary exato de `TAMANHO_MAXIMO_TESE_ADVOGADO_CONTRA` sem teste automatizado (comportamento manualmente verificado como correto), combinação de todos os arrays opcionais vazios simultaneamente sem teste combinatório.

**Ação pendente sua**: rodar migration `0039` (e `0040`, ver item 6) no Supabase; testar o fluxo ponta a ponta em produção (colar tese, upload, selecionar tese cadastrada, conferir que o aviso de "hipótese da IA" aparece destacado na seção de precedentes).

### Prompt mestre de 29 fases (Ciclos 1-7) — estado atualizado

**Estado real por Ciclo** (atualizado):
- **Ciclo 1 (Core Jurídico)**: Fases 0-3 completas.
- **Ciclo 2 (IA Jurídica)**: Fases 4 (Auditor de Peças) e **5 (Advogado do Contra) completas**. **Fases 6-7 (Estrategista, Pesquisa Jurídica) NÃO iniciadas.**
- **Ciclos 3-7**: nenhuma fase iniciada (Workflow Engine, Triagem/Portal/WhatsApp/Áudio, Calculadoras/Memória/Agentes, Dashboard redesign completo/planos Free-Pro-Firm, Segurança/Command Center/Observabilidade/Testes).

**Próximo passo recomendado pra próxima sessão**: **Fase 6 — Estrategista Jurídico** (organizar objetivo/tese principal/teses subsidiárias/provas/riscos/próximos passos do caso, com opção de transformar recomendação em tarefa — ver `tarefas_caso`). Mesmo padrão de ondas: `architect`(ADR, opcional dado o volume de precedente já existente)/`database` → `ai-engineer` → `senior-engineer` → revisão paralela `security`+`qa`+tech lead (usar `subagent_type: "general-purpose"` para o papel de tech lead — **`techlead` não existe no registry de agentes deste ambiente**, confirmado nesta sessão).

Fases que envolvem plano (Free/Pro/Firm): ao criar cada feature nova, adicionar em `lib/planos/gating.ts#FEATURES_PREMIUM` como Pro-only por padrão (mesmo padrão das 11 features já classificadas assim), a menos que o usuário diga o contrário.

## 10. Notas de processo desta sessão

- Sem acesso a MCP do Supabase/Stripe nesta sessão (`ToolSearch` não achou nenhuma ferramenta correspondente) — toda verificação de config/migration foi por leitura de código + `vercel env ls` (só lista nomes/datas, não valores). `vercel env pull` foi bloqueado pelo classificador de permissão do ambiente (puxaria secrets pro disco) — não insisti, é uma barreira de segurança do harness, não um erro.
- `npm install` rodado (deps opcionais faltando localmente — `mammoth`, `@langchain/core` — impediam 5 suítes de teste de rodar; resolvido, sem mudança de versão de nada, só instalação do que já estava no `package-lock.json`/`package.json`).
- Bug real encontrado e corrigido durante a sessão: `npx next build` local quebrava em `/auth/definir-senha` (client component pré-renderizado estaticamente tentando instanciar o client do Supabase) — corrigido com `export const dynamic = "force-dynamic"` (commit `b0afeeb`).
- Todo código novo tem teste e passou por `tsc --noEmit` + suíte completa + `next build` antes de cada commit. Suíte terminou esta sessão em 350 testes verdes (começou em 317).
- Fase 5 foi construída via ondas de subagentes (`database`→`ai-engineer`→`senior-engineer`→revisão paralela `security`+`qa`+`general-purpose`), cada uma verificada por mim (tsc+vitest, e nas duas últimas também `next build`) antes do commit — nenhum relatório de agente foi aceito sem confirmação própria.
