# Pendências — JurídicoIA (SaaS jurídico)

Estado em 2026-08-18. Repo: `pedrohenriquesanchesleal4-debug/juridico-ia-saas`.
Branch de trabalho atual: **`staging`** (não é a `main`/prod — Vercel deploya `main`, então nada aqui vai pro ar sozinho até um merge explícito pedido pelo dono do produto).
`staging` diverge de `main` exatamente no commit `07dd211`.

## 0. Já em produção (main, commit `07dd211`)

- Mobile responsivo (sidebar drawer) + correção ortográfica.
- Copiloto jurídico com RAG (Gemini + pgvector) e fluxo de propostas com aprovação humana.
- Fix de performance (dedup de `auth.getUser()` por request).
- Motion v1 na landing (GSAP) — **usuário rejeitou o resultado visual**, pediu redesign (ver seção 2).
- Prazo automático via DJEN, portal do cliente, financeiro/honorários, assinatura eletrônica (Autentique), link "Meu perfil" (OAB) na sidebar.
- Todas as migrations `0001` a `0007` já rodadas no Supabase pelo usuário.

## 1. Configuração pendente (usuário precisa fazer)

- [ ] Confirmar `GEMINI_API_KEY` preenchida DE VERDADE em `.env.local` e na Vercel (histórico de ficar vazia por engano).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — usada pelo cron do DJEN e pelo webhook de assinatura (rodam sem sessão de usuário).
- [ ] `CRON_SECRET` — protege `app/api/cron/sincronizar-djen/route.ts`.
- [ ] `AUTENTIQUE_API_TOKEN` + `AUTENTIQUE_WEBHOOK_SECRET` — conta grátis em autentique.com.br.
- [ ] `DJEN_API_BASE_URL` (opcional, tem default no código).
- [ ] Rodar migrations `0004`, `0006`, `0007` no Supabase — usuário confirmou que já rodou (2026-08-18), mas revalidar se a branch `staging` ainda não foi mergeada e novas migrations forem criadas depois.
- [ ] Depois de preencher env vars na Vercel: sempre fazer **redeploy manual** (Vercel não aplica retroativamente).

## 2. Em andamento / aguardando validação

- **Fix de explosão de tokens no chat IA** (commit `d953798` na branch `staging`): causa raiz identificada por leitura de código (SYSTEM_PROMPT forçava formato de 9 seções pra qualquer mensagem, sem teto de `maxOutputTokens`). Corrigido, mas **não testado com chave real** — o agente que corrigiu não tinha `GEMINI_API_KEY` no ambiente dele. Rodar `npm run dev` com chave real, mandar "oi" e depois uma pergunta jurídica de verdade, conferir `usageMetadata` (script de reprodução ficou em algum lugar do scratchpad da sessão anterior, pode ter sido limpo — se não achar, é só logar `resposta.response.usageMetadata` em `lib/ia/gemini.ts`).
- **Redesign da landing (fio dourado + cinematográfico)**: agente `animation` disparado para resolver bug de scroll travado (pin do GSAP não liberando) + nova composição assimétrica ("fio dourado orgânico" conectando seções + luz diagonal cinematográfica). Pode ainda estar rodando ou ter terminado sem eu ter revisado/commitado — **conferir status, rodar `npx eslint` + `npx next build`, testar visualmente, e só then commitar na `staging`**. Havia mudanças não commitadas em `components/marketing/features-scroller.tsx` e um arquivo novo `components/marketing/light-beam.tsx` na última checagem.

## 3. Aprovado pelo usuário, ainda não implementado

Usuário pediu explicitamente ("pode botar essas 6") as 6 features sugeridas:

1. **Triagem automática de lead** — formulário público na landing, IA pré-analisa (tipo de caso, urgência, viabilidade) antes de virar ficha. Reaproveitar lógica de `legacy/assistente-juridico-v5/src/triagem.js` como referência.
2. **Lembrete via WhatsApp** — prazo/parcela vencendo dispara mensagem automática (Meta Cloud API). Referência: `legacy/assistente-juridico-v5/src/whatsapp.js`.
3. **Relatório de produtividade por advogado** — casos, faturamento, taxa de êxito por perfil, no dashboard. Só leitura agregada sobre `fichas_caso`/`contratos_honorario`/`parcelas_honorario` já existentes — não deveria precisar de schema novo.
4. **Score de risco do caso** — "semáforo" (baixo/médio/alto) calculado pela IA, exibido na lista de fichas. Precisa de campo novo em `fichas_caso` (ex: `nivel_risco`).
5. **Jurisprudência ampliada no RAG** — conectar API pública de jurisprudência (STF/STJ) como fonte adicional de embeddings, complementando os uploads manuais.
6. **Consulta pública por CPF no portal do cliente** — cliente confere status básico via CPF antes do convite formal existir.

### Como abordar (mesmo padrão usado nas features anteriores)
1. Rodar um agente `database` primeiro pra desenhar UMA migration nova (ex: `0008_triagem_produtividade_risco.sql`) cobrindo: tabela de leads/triagem pública, campo `nivel_risco` em `fichas_caso`, config/log de WhatsApp, e o que a consulta pública por CPF precisar de RLS.
2. Depois, disparar implementação em paralelo por feature, cada uma em arquivos separados (só cuidado: WhatsApp e lembrete de prazo/parcela podem tocar os mesmos arquivos de prazos/financeiro — sequenciar essas duas ou isolar em helper, como foi feito com notificação do portal).
3. Ao final de cada leva: eu mesmo validar `npx eslint` + `npx next build` no conjunto todo antes de commitar (os agentes concorrentes não compartilham verificação entre si).

## 4. Entregável concluído

- **Dossiê comercial** publicado: https://claude.ai/code/artifact/0a01e5e5-1612-453a-928e-9893aa3d33b5 — cobre problema de mercado (com fontes), os 6 módulos já entregues, diferenciais vs. concorrentes (Astrea/Projuris), segurança/confiança, e roadmap (as 6 features da seção 3). Privado por padrão — usuário precisa compartilhar pelo menu da própria página se quiser mandar pra terceiros. Pra atualizar depois (ex: quando as 6 features novas saírem do roadmap e virarem módulo entregue), republicar passando `url` desse mesmo link.

## 5. Lembretes de processo (já validados com o usuário nesta sessão)

- Delegar para os agentes especializados do Izanagi (`.claude/agents/`) em vez de implementar direto — regra do projeto.
- Rodar `npx eslint` + `npx next build` **eu mesmo** depois de qualquer agente (eles às vezes não têm Bash disponível, ou rodam em paralelo sem ver o resultado uns dos outros).
- Nunca pedir/aceitar chave de API colada no chat — sempre `.env.local` ou Vercel env vars diretamente.
- Commits vão pra branch `staging`, nunca `main`, até o usuário pedir explicitamente pra ir pra produção.
- Antes de qualquer redesign visual, alinhar direção com o usuário (ele já rejeitou duas tentativas de landing antes de aprovar a direção "fio dourado + cinematográfico" combinando duas propostas).
