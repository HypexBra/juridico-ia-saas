# Handoff — sessão 2026-08-21

Sessão parada aqui de propósito (pouco token restante). Tudo abaixo commitado e pushado em `main`. HEAD atual: `014d664`.

## 1. Pool multi-chave de LLM (Gemini/Groq) — completo, em produção

- API keys saíram do `.env` fixo e foram pro banco (`ia_provider_chaves`, migration `0032`), cifradas AES-256-GCM (`IA_PROVIDER_KEY_ENCRYPTION_KEY`, env var própria — já setada na Vercel e no `.env.local`).
- Pool com round-robin/failover atômico via RPC Postgres (`selecionar_e_registrar_uso_chave`, `FOR UPDATE SKIP LOCKED`), cooldown de 65s por chave após 429.
- 3 chaves já cadastradas e testadas ponta a ponta: Gemini principal, Gemini secundária, Groq principal (a antiga `GROQ_API_KEY` do `.env.local` ficou órfã — considere revogar no console da Groq).
- Groq migrado pra LangChain (`@langchain/groq`); Gemini ficou no SDK cru (`@google/genai`) de propósito — `@langchain/google-genai` não suporta combinar `googleSearch` grounding com function-calling na mesma chamada, quebraria a busca atualizada.
- Switch manual no chat (Automático/Gemini/Groq) + tela `/admin/ia-chaves` pra gerir o pool.
- Bug corrigido: fallback Gemini→Groq ficava preso mostrando "IA indisponível" sem trocar de fato — `TodosProvidersIndisponiveisError` agora distingue pool esgotado de erro de config.

**Ação pendente sua:** nenhuma — já em produção e funcionando.

## 2. Fase 3 — Document Intelligence (Ciclo 1, completo)

Upload/análise de documento (PDF/DOCX/imagem) individual e em lote + comparador de documentos (A×B). `lib/analise-documento/**`, `app/app/documentos/**`, migrations `0033`/`0034`. Revisado (security+qa+techlead), achados corrigidos.

**Ação pendente sua:** rodar migrations `0033`/`0034` no Supabase, se ainda não rodou.

## 3. Fase 4 — Auditor de Peças (Ciclo 2, completo)

Advogado cola texto de peça ou faz upload → IA avalia com notas 0-10 (fundamentação/coerência/pedidos/jurisprudência) + veredicto de risco + achados citáveis + contra-argumentos prováveis. `lib/auditoria-peca/**`, `app/app/auditor/**`, migration `0035`. Guardrail de "humildade epistêmica" (nota extrema exige achado de lastro, validado em Zod, não só instrução de prompt). Aviso fixo na UI: pontuação é ferramenta auxiliar, nunca verdade jurídica. Revisado e corrigido.

**Ação pendente sua:** rodar migration `0035` no Supabase.

## 4. Rate-limit transversal do pool de IA — completo

Achado de segurança repetido (Document Intelligence + Auditor): nada impedia um escritório disparar várias chamadas pesadas de IA em paralelo, saturando o pool compartilhado entre TODOS os tenants. Resolvido: `lib/ia/limite-concorrencia.ts#existeProcessamentoIaEmAndamento()` — 1 job pesado de IA por vez por escritório, checando as 4 tabelas (`analises_processo`, `analises_documento`, `comparacoes_documento`, `auditorias_peca`). Aplicado em todas as actions relevantes. Chat NÃO entra nesse gate (tem defesa própria: limite mensal por plano). Redline também não entra (não tem estado "processando" hoje — registrado como dívida técnica se o volume justificar).

## 5. Bugs corrigidos nesta sessão

| Bug | Causa raiz | Commit |
|---|---|---|
| Limite de IA não subia no plano Pro | Código sempre usava `LIMITE_MENSAGENS_FREE` (25), ignorando o plano | `21d0175` |
| Modais (Novo modelo/Nova ficha/Novo contrato honorário) com layout quebrado | `overflow-x-hidden` num ancestral do dashboard clipava o `position:fixed` do modal | `19662ce` |
| Autentique: "enviado mas falha ao salvar status localmente" (100% dos envios) | Coluna `status varchar(20)` menor que o próprio valor do CHECK constraint (`'aguardando_assinatura'` tem 21 chars) — nenhum documento jamais tinha conseguido mudar de status desde a criação da tabela | `301484a` + migration `0036` |
| "Lógica condicional não funciona" em Modelos | Era o mesmo bug do modal quebrado — usuário não conseguia nem salvar o modelo direito. Resolvido junto. | (mesmo do modal) |

**Ação pendente sua:** rodar migration `0036` no Supabase (amplia a coluna `status` pra varchar(30)).

## 6. Features novas pedidas pelo usuário

- Botão "Adicionar tese" manual na ficha do caso (antes só existia via write-back automático da IA). Commit `a96aaba`.
- Admin: seletor de plano (Free/Pro) por escritório + botão "Redefinir senha" do usuário (envia link por e-mail via `auth.resetPasswordForEmail`, nunca expõe senha nova). Commit `301484a`.

## 7. Nota importante sobre "documentos do plano Pro" (não é bug)

Usuário reportou confusão com a seção "Automação de documento com lógica condicional" na ficha — achou que era erro. Não é: é estado vazio de verdade (nenhum modelo com `{{#se}}`/`{{#cada}}` cadastrado ainda). É uma feature DIFERENTE do Document Intelligence recém-criado — vale considerar renomear/explicar melhor na UI pra não confundir as duas (não implementado nesta sessão, é sugestão).

## 8. Débito técnico registrado (não bloqueante)

- Upload de arquivo (todas as features: base-conhecimento, análise de processo, Document Intelligence, Auditor de Peças) valida só extensão/MIME declarado, não conteúdo binário real. Consistente em todo o projeto, nunca corrigido, seria um esforço transversal.
- Redline sem gate de concorrência (ver item 4).
- `FieldError` (`components/ui/input.tsx`) sem `aria-live`/`role="alert"` — achado de acessibilidade antigo, replicado em todo formulário novo por ser componente compartilhado.

## 9. Próximo passo — Fase 5: Advogado do Contra

**Não iniciada — só o pedido de ADR foi disparado e cancelado a meio caminho por falta de token, nenhum arquivo foi criado.** Do roadmap: IA assume a perspectiva da parte contrária de uma tese/petição, produz argumentos contrários, fragilidades, contradições, precedentes contrários PROVÁVEIS (deixar claro na UI que é hipótese da IA, não citação verificada — isso só vem na Fase 7, pesquisa jurídica com fontes reais), pontos que precisam de prova, perguntas difíceis, recomendações de fortalecimento.

Pontos de partida pra próxima sessão (já mapeados, não decididos):
- Estruturalmente parecido com o Auditor de Peças (Fase 4) — mas sem notas, com achados adversariais. Decidir: tabela nova ou reuso.
- Entrada pode incluir selecionar uma tese já cadastrada em `teses_caso` (Fase 1), não só colar/upload.
- Precisa entrar na lista de tabelas de `lib/ia/limite-concorrencia.ts` assim que a tabela for criada.
- Seguir o mesmo padrão de ondas usado nas Fases 3/4: `architect` (ADR) → `database` → `ai-engineer` → `senior-engineer` → revisão `security`+`qa`+`techlead`(`general-purpose`, tipo `techlead` não existe no registry de agentes deste ambiente).

## 10. Notas de processo desta sessão

- Descoberto e contornado: agentes em background compartilham o MESMO working tree/index git — houve 2 incidentes de commits caindo em branch errada (`staging` em vez de `main`) e 1 de arquivos de agentes diferentes se misturando no mesmo commit por corrida no `git add`/`git commit`. Nenhum trabalho foi perdido (recuperado via `git stash`/cherry-pick/worktree isolado quando necessário), mas vale considerar `isolation: "worktree"` no Agent tool pra waves futuras que rodem em paralelo mexendo em git.
- Padrão desta sessão: cada onda de implementação foi verificada de verdade (build+testes rodados por mim, não só confiando no relatório do agente) antes do commit ser considerado válido — 1 vez o relatório de um agente descreveu trabalho que não existia de fato no disco (achado só depois de eu conferir).
- Outra sessão trabalhou em paralelo no mesmo repo fazendo o redesign da landing page (branch `staging`, arquivos `app/page.tsx`/`app/globals.css`/`app/layout.tsx`/`components/marketing/*`) — nunca tocado por esta sessão, deliberadamente.
