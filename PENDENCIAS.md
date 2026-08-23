# Pendências — JurídicoIA (SaaS jurídico)

Estado em 2026-08-23 (pós-sessão 6). Repo: `pedrohenriquesanchesleal4-debug/juridico-ia-saas`.
Branch de trabalho: **`staging`** — Vercel deploya `main`; nada vai pro ar até merge explícito pedido pelo dono do produto.
Histórico detalhado por sessão: ver `HANDOFF_2026-08-*.md`.

## 1. CRÍTICO — ação manual do usuário

### 1.1 Migrations 0037–0046 no Supabase
Features das sessões 4–6 dependem delas (equipe, Advogado do Contra, Estrategista,
pesquisa STJ, prioridade de tarefas, workflows, observabilidade de uso e memória do
escritório estão DEGRADADOS/INERTES no ar até a aplicação).
Passo a passo, ordem e SQL de verificação: **`docs/MIGRATIONS_PENDENTES.md`**.

### 1.2 Redirect URL no Supabase
Authentication → URL Configuration → Redirect URLs:
adicionar `https://juridico-ia-saas.vercel.app/auth/callback`
(sem isso convite de equipe e reset de senha quebram).

### 1.3 Primeiro sync STJ + env vars
- Disparar o primeiro sync da base de acórdãos: `curl -X POST .../api/cron/sync-stj -H "Authorization: Bearer $CRON_SECRET"` (ou POST autenticado como owner em `/app/pesquisa`). Até lá o verificador de citações responde "não verificada" para tudo — comportamento correto.
- Confirmar na Vercel (e `.env.local`): `GEMINI_API_KEY`, `GROQ_API_KEY` (agora também habilita ditado por voz), `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `AUTENTIQUE_API_TOKEN` + webhook secret, `DJEN_API_BASE_URL`, trio Stripe (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO_MENSAL`, `STRIPE_WEBHOOK_SECRET`) — causa raiz provável do bug "não leva pro checkout" (`erros-corrigidos.md`, 2026-08-20). Depois de preencher: **redeploy manual** (Vercel não aplica retroativamente).

## 2. Aguardando validação do usuário

- **Landing v3 "papel-e-tinta"** (sessão 5): completa, build/testes limpos — falta teste visual (desktop/tablet/mobile) antes de considerar fechada.
- **Ditado por voz no chat** (sessão 6): testar gravar → transcrever → revisar → enviar.

## 3. Roadmap do prompt mestre — estado pós-sessão 6

Ciclos 1–3 completos; Ciclo 4 completo agora (Fase 15 áudio entregue); Ciclo 5 completo
(calculadoras + memória do escritório Fase 17 + orquestração leve Fase 18); Ciclo 6
parcial; Ciclo 7 quase completo (observabilidade de custo IA por token/modelo/origem
entregue na Fase 27 — página `/app/uso`).

### Restante (com critério de desbloqueio)

| Item | Fase | Bloqueio | Próximo passo |
|---|---|---|---|
| Plano Firm (billing multi-usuário avançado) | 22 | **Decisão de negócio**: preço, limites e criação do Price recorrente no Stripe. Implementar sem credenciais seria fake — proibido. | Definir preço → criar Price no Stripe → adicionar `STRIPE_PRICE_ID_FIRM_MENSAL` + gating |
| Feriados forenses POR comarca (calculadora de prazos) | extra | Fonte de dados confiável por tribunal (hoje só nacionais) | Pesquisar fonte oficial/API por TJ |
| Consulta multi-tribunal DataJud | extra | Credenciamento na API pública (chave ainda não solicitada) | Solicitar em datajud-wiki.cnj.jus.br; status visível em `/app/prazos` |
| Performance (Fase 28) | 28 | Sem alvo mensurável definido | Medir Core Web Vitals em prod e otimizar o que medir mal |
| Testes E2E Playwright (Fase 29) | 29 | Ambiente local OOM-prone (~5,7 GB RAM; download dos browsers pesado) | Instalar `@playwright/test` + chromium numa máquina com folga; specs mínimas: login → ficha → prazo |

## 4. Lembretes de processo (validados com o usuário)

- Delegar aos agentes especializados Izanagi; orquestrador roda `eslint`/`tsc`/`build`/`vitest` ele mesmo após cada leva (agentes paralelos não compartilham verificação).
- Nunca pedir/aceitar chave de API colada no chat — sempre `.env.local` ou Vercel env vars.
- Commits vão pra `staging`, nunca `main`, até pedido explícito.
- Antes de redesign visual, alinhar direção com o usuário (spec vigente: `docs/redesign-landing-v3.md` — componentes fora dela não entram na landing).
