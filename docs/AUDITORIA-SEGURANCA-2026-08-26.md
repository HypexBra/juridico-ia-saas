# Auditoria de segurança · JurídicoIA · 2026-08-26

Escopo: autenticação e sessão, isolamento multi-tenant (RLS), rotas de API
pública e webhooks, jobs de cron, uploads, criptografia de segredos,
superfície pública (portal do cliente, triagem), tratamento de segredos no
repositório.

Branch auditada: `staging`. Correções aplicadas nesta sessão estão marcadas
como **CORRIGIDO**; o que ficou aberto tem o motivo e a recomendação.

---

## 1. CORRIGIDO · Header de identidade forjável (`x-user-id` / `x-user-email`)

**Severidade:** alta (bypass de autenticação latente; hoje contido pela RLS)
**Arquivos:** `lib/supabase/middleware.ts`, `lib/app/current-user.ts`,
`lib/app/current-client-portal.ts`

O middleware injeta `x-user-id` / `x-user-email` a partir da sessão validada,
como fast path para `getUsuarioAtual()` não repetir o round-trip do
`auth.getUser()`. O problema estava no caminho **sem sessão**: ali a
requisição seguia adiante intacta, então um header de mesmo nome enviado pelo
cliente sobrevivia até a rota.

```
curl https://<host>/app/dashboard -H "x-user-id: <uuid-da-vitima>"
```

`getUsuarioAtual()` aceitava esse id como identidade resolvida.

**Por que não era exploração direta hoje:** as queries seguintes usam o client
de sessão (`lib/supabase/server.ts`), e as policies resolvem `auth.uid()` pelo
JWT do cookie, não pelo header · sem cookie, o `select` em `perfis` volta
vazio e a função cai em `return null`. O bypass depende de a RLS estar
correta em 100% dos caminhos, para sempre.

**Por que ainda assim é grave:** o projeto tem 20+ pontos que usam
`createAdminClient()` (service_role, bypassa RLS). A primeira rota que
resolver o usuário por `getUsuarioAtual()` e depois consultar com o client
admin vira bypass de autenticação direto, sem nenhum aviso.

**Correção:** `semHeadersDeIdentidadeDoCliente()` remove os dois headers de
toda requisição antes de qualquer coisa, em todos os caminhos do middleware
(inclusive os dois de fail-open). Só o middleware escreve esses headers.

---

## 2. CORRIGIDO · Replay de webhook do Stripe

**Severidade:** média
**Arquivo:** `lib/billing/verificar-assinatura-webhook.ts`

O HMAC era validado sobre `${t}.${corpoBruto}`, mas o `t` nunca era conferido
contra o relógio. Um HMAC válido continua válido para sempre: quem obtivesse
uma entrega legítima (log de proxy, header vazado, request salvo em
ferramenta de debug) poderia reenviá-la indefinidamente e a rota aceitaria.

Impacto concreto: reenviar um `checkout.session.completed` capturado
restauraria `escritorios.plano = 'pro'` de um escritório rebaixado, quantas
vezes quisesse.

**Correção:** janela de tolerância de 300s (mesmo padrão da biblioteca oficial
do Stripe). Coberto por testes de replay antigo, timestamp futuro, e limite
da janela.

---

## 3. CORRIGIDO · Rotação de `STRIPE_WEBHOOK_SECRET` rejeitaria entregas válidas

**Severidade:** média (disponibilidade de billing)
**Arquivo:** `lib/billing/verificar-assinatura-webhook.ts`

Durante rotação de endpoint secret, o Stripe envia o header com mais de um
`v1=` (um por segredo ativo). O parser guardava os pares num `Map`, então só o
**último** `v1` sobrevivia. Se o válido viesse primeiro, toda entrega seria
rejeitada durante a janela de rotação · assinaturas ficariam sem atualizar
sem nenhum erro aparente no produto.

**Correção:** coleta todos os `v1` e compara contra todos, sem short-circuit.

---

## 4. CORRIGIDO · Autorização dos crons: `Bearer undefined` e comparação não constante

**Severidade:** média (estrutural)
**Arquivos:** `app/api/cron/*` → novo `lib/cron/autorizar.ts`

O padrão `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` compara, com a
env var ausente, contra a string literal `"Bearer undefined"` · qualquer um
que mande esse header exato passa. As quatro rotas já checavam a presença da
env var antes, justamente por isso, mas era disciplina repetida em quatro
arquivos, fácil de esquecer no quinto. A comparação também era `!==` de
string (sai no primeiro byte diferente).

**Correção:** `autorizarChamadaCron()` centraliza: fail-closed com 500 quando
a env var falta (500 e não 401 · o problema é do servidor, não da credencial
de quem chamou), e `timingSafeEqual` para a comparação. As quatro rotas
existentes foram migradas. 7 testes, incluindo regressão explícita do
`Bearer undefined`.

---

## 5. CORRIGIDO · Cron do STJ respondia 405 em toda execução agendada

**Severidade:** baixa (disponibilidade / dado desatualizado, não exposição)
**Arquivo:** `app/api/cron/sync-stj/route.ts`

A rota só exportava `POST`. O Vercel Cron dispara sempre `GET`. A entrada
`/api/cron/sync-stj` no `vercel.json` nunca executou nada desde que foi
criada; o único sync que aconteceu foi manual (`PENDENCIAS.md` §1.3).

Impacto de segurança indireto: a jurisprudência que embasa saída de IA em
peça jurídica estava congelada sem ninguém saber. É exatamente o silêncio que
o novo `rag_execucao_log` + alerta passam a quebrar.

**Correção:** `export const GET = POST`, e o sync passou para dentro do job
diário orquestrado.

---

## 6. ABERTO · Rate limit por IP é contornável e não é distribuído

**Severidade:** baixa
**Arquivos:** `lib/rate-limit.ts`, `app/portal/consultar/actions.ts`,
`app/triagem/[slug]/actions.ts`

Dois limites, ambos já documentados no próprio código:

1. **Estado em memória do processo.** Em serverless, cada instância tem o
   próprio contador, e ele zera a cada cold start. O limite efetivo é N vezes
   o configurado.
2. **Chave derivada de `x-forwarded-for`,** pegando o primeiro elemento da
   lista. Esse é o padrão spoofável quando o proxy **acrescenta** em vez de
   sobrescrever. Na Vercel o header é populado pela plataforma, então na
   prática o risco é menor · mas o header confiável na Vercel é
   `x-vercel-forwarded-for`, e é dele que a chave deveria sair.

**Contexto que mantém isso em baixa:** a consulta pública por CPF já é
`fail-same` (mensagem idêntica para CPF inválido, inexistente e escritório
errado) e a migration 0008 registra "enumeração de CPF é um risco aceito".

**Recomendação (não aplicada · muda comportamento de duas rotas públicas e
merece decisão explícita):** trocar a resolução de IP para
`x-vercel-forwarded-for` com fallback para o atual, e mover o contador para
uma tabela com `upsert` atômico se a enumeração deixar de ser risco aceito.

---

## 7. ABERTO (avaliado, sem ação) · Sem idempotência por `event.id` no Stripe

**Severidade:** informativo
**Arquivo:** `app/api/webhooks/stripe/route.ts`

O Stripe pode entregar o mesmo evento mais de uma vez. Não há tabela de
eventos processados. **Avaliado como sem risco hoje:** as duas escritas são
naturalmente idempotentes (`upsert` com `onConflict: escritorio_id`, e
`update ... eq(stripe_subscription_id)`). Uma reentrega recria o mesmo estado.

Passa a ser necessário no momento em que o handler ganhar um efeito
não-idempotente (enviar e-mail, creditar saldo, emitir nota).

---

## O que foi verificado e está correto

Registrado para não ser reauditado sem motivo:

- **Isolamento multi-tenant.** `escritorio_atual()` resolve por `auth.uid()`;
  `buscar_chunks_similares` é `security definer` e filtra o escritório
  **dentro da função**, não só por RLS; o CHECK
  `chk_embeddings_escritorio_por_fonte` (0008) impede que um chunk de tenant
  seja gravado sem dono e que um chunk compartilhado ganhe um.
- **API pública v1.** `escritorio_id` vem sempre do resultado de
  `autenticarApiKey`, nunca de parâmetro do cliente. A chave é buscada por
  hash em índice único (sem comparação de string). O gating de plano é
  revalidado a cada request, fail-closed.
- **Webhook do Autentique.** HMAC sobre o corpo bruto, com
  `timingSafeEqual`, antes de qualquer toque no banco.
- **Prompt injection no RAG.** Contexto recuperado entra num bloco
  `<<<CONTEXTO_RECUPERADO_NAO_CONFIAVEL>>>` explicitamente marcado como dado,
  reforçado no `RAG_TOOLING_PROMPT`. As features de análise têm o mesmo aviso
  (`AVISO_INJECAO`). Toda ação de escrita da IA passa por
  `propostas_acao` com aprovação humana.
- **Uploads.** Magic bytes conferidos além de extensão/MIME declarado
  (`lib/uploads/validacao.ts`), com o limite conhecido documentado (um ZIP
  qualquer renomeado para `.docx` passa).
- **Criptografia de segredos.** AES-256-GCM com IV aleatório por operação,
  authTag verificado, e master key + salt separados por domínio (WhatsApp e
  chaves de IA não compartilham blast radius).
- **Segredos no repositório.** `.gitignore` cobre `.env*` com exceção só do
  `.env.example`. `git ls-files` confirma que nenhum `.env` real está
  versionado.
- **Admin da plataforma.** `getAdminAtual()` usa `auth.getUser()` direto (não
  o fast path por header), com RLS `plataforma_admins_self_select` no banco.
  Não foi afetado pelo item 1.
