# Spec — Redesign Landing v3 "Papel-e-Tinta" (editorial claro)

> Contrato de coordenação entre agentes. Fonte da verdade visual/copy.
> Direção iniciada na sessão de 22/08 (tokens em `globals.css` + fontes em `layout.tsx` + ícones em `icons.tsx`) e interrompida antes da migração das seções.

## 1. Conceito

Landing pública do Jurídico IA com estética **editorial clara**: papel off-white, tinta quase-preta, UM acento discreto (vermelho-lacre). Sensação alvo: "software jurídico premium desenhado por pessoas obsessivas com detalhes" — NÃO "landing page de IA". A tecnologia aparece no comportamento da interface (sistemas que trabalham silenciosamente), nunca em clichê visual.

**Proibições absolutas:** gradientes roxo/azul, neon, glow, glassmorphism, cérebro/robô/balança/martelo/colunas gregas, cards flutuantes em massa, `rounded-2xl` uniforme, badges empilhados, números inventados ("economize 80%"), copy "revolucione/potencialize/futuro/disruptivo/AI-powered", dashboard screenshot no hero.

## 2. Design tokens (JÁ implementados em `globals.css` — usar, não recriar)

| Token | Valor | Uso |
|---|---|---|
| `bg-paper` | `#faf9f5` | fundo padrão da landing |
| `bg-paper-2` | `#f3f1ea` | superfícies alternadas / painéis |
| `bg-paper-3` | `#edebe3` | superfícies mais marcadas |
| `text-ink` | `#141412` | títulos, texto principal |
| `text-ink-2` | `#44423b` | corpo secundário |
| `text-ink-3` | `#6e6a60` | meta/legendas |
| `text-lacre` | `#8b2e1f` | ÚNICO acento: marcações, nós do fio, destaques pontuais |
| `text-lacre-bright` | `#d97a5c` | acento sobre superfície escura (painel tinta) |

Fontes (variáveis já carregadas em `layout.tsx`):
- **Display/títulos**: `font-serif-ed` (Fraunces) — headlines editoriais, itálico para ênfase
- **Interface/corpo**: `font-sans-ed` (Instrument Sans)
- **Dados/kickers**: `font-mono-ed` (IBM Plex Mono) — kickers uppercase tracking-wide, números, rótulos de sistema

Regras de forma: cantos `rounded-none`/`rounded-sm` (exceção: pílulas de status `rounded-full`); hairlines `border-ink/10`; sombras quase nulas (máx. `shadow-sm` em painéis elevados). Botão primário: fundo `ink`, texto `paper`; secundário: link textual com `IconArrowRight`. O lacre NUNCA é fundo de botão.

## 3. Gramática de layout

- Seção padrão: `py-24 md:py-36`, container `mx-auto max-w-6xl px-5 md:px-10`.
- Grid assimétrico editorial: kicker mono à esquerda (`md:w-1/4`), conteúdo dominante à direita (`md:w-3/4`) ou offset intencional — nunca tudo centralizado simétrico.
- Kicker padrão: `<p class="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">` com número da seção (`01`, `02`…).
- H2 Fraunces `text-4xl md:text-6xl leading-[1.05] tracking-tight text-ink`, palavras-chave em itálico.
- Corpo Instrument Sans `text-lg text-ink-2 max-w-prose`.
- Mobile: coluna única, hierarquia preservada, animações reduzidas.

## 4. Motion (direção de arte, não efeito)

- Primitivo existente: `<Reveal>` (GSAP ScrollTrigger, power3.out 900ms) — usar como padrão.
- `prefers-reduced-motion`: tudo estático (helpers já fazem isso — manter o padrão `lib/motion/gsap.ts`).
- Loops ambientes: lentos (8–14s), lineares/ease-in-out suaves, opacidade/translate mínimos. Nada piscando/girando/quicando.
- CSS scroll-driven (`animation-timeline`) quando não precisar de geometria recalculada.
- Performance: sem blur filters grandes, sem imagens raster (tudo SVG/CSS), animações GPU-friendly.

## 5. Assinatura visual — "Fio do Caso"

O `silver-thread.tsx` (linha SVG contínua que se desenha no scroll) vira o fio condutor em tinta sobre papel: linha `stroke ink @ 18% opacity`, sem glow. Ao longo dele, 6 nós pequenos (círculos lacre 5px) com rótulos mono discretos (desktop): CASO → DOCUMENTO → ANÁLISE → ESTRATÉGIA → TAREFA → AÇÃO, posicionados nas frações verticais correspondentes às seções. Manter TODA a engenharia existente (guard de resize mobile, reduced-motion, rebuild responsivo). Painel tinta (seção proativa) usa `bg-ink` com texto `paper` e acento `lacre-bright`.

## 6. Copy OFICIAL (usar literalmente; ajustes só de quebra tipográfica)

- **Hero H1**: "O trabalho jurídico, finalmente organizado."
- **Hero sub**: "Documentos analisados, prazos encontrados nos diários oficiais, tarefas criadas sozinhas e o cliente sempre informado. Você fica com a parte que só um advogado faz."
- **CTA primário**: "Começar gratuitamente" · secundário: "Ver como funciona"
- **Prova (mono, pequena)**: "Prazos monitorados no DJEN · Pesquisa com fonte verificável · Portal do cliente"
- **01 Problema**: "O problema não é o Direito. É tudo o que acontece ao redor dele." — nuvem tipográfica: Pesquisar, Organizar, Ler, Comparar, Escrever, Revisar, Acompanhar, Cobrar, Responder, Atualizar → transição: "É aí que o Jurídico IA entra."
- **02 Produto/Caso**: "Um lugar para o caso inteiro." + "A IA não começa pela resposta. Começa pelo contexto." — painel do caso: Cliente, Processo, Documentos, Histórico, Jurisprudência, Estratégia, Tarefas + "Agora pergunte qualquer coisa sobre este caso." com pergunta/resposta realista citando o contexto.
- **03 Documentos**: "Cada documento, lido com atenção de especialista." — página de documento com marcações: 3 pontos relevantes · 2 inconsistências · 1 prazo · 4 documentos relacionados.
- **04 Auditoria**: "Antes de você assinar, ela lê de novo." — relatório: Fundamentação ✓ · Coerência ✓ · Pedidos ! · Jurisprudência ✓ · Contradições 2 (+ nota "ferramenta auxiliar — a revisão final é sempre sua").
- **05 Advogado do contra**: "E se a outra parte atacasse por aqui?" — tese à esquerda; fragilidade, argumento contrário, precedente contrário e recomendação à direita.
- **06 Automação**: "O trabalho que você não precisa mais lembrar de fazer." — fluxo Novo cliente → Triagem → Documentos → Análise → Estratégia → Documento → Revisão → Prazo, progressivo no scroll.
- **07 IA proativa (painel tinta)**: kicker "BOA TARDE." / "Encontrei 3 coisas que precisam da sua atenção." itens 01 Prazo em 2 dias. 02 Cliente aguardando documento. 03 Nova movimentação relevante. Headline fora do painel: "Você não precisa perguntar tudo."
- **08 Pesquisa**: "Resposta sem fonte não entra na página." — busca "responsabilidade civil por cobrança indevida" → grupos LEGISLAÇÃO / JURISPRUDÊNCIA / STJ / TRIBUNAIS + cartão de fonte verificável (órgão, número, data, relator, trecho). Nota: quando não há fonte, o sistema diz "Não foi localizada fonte verificável suficiente."
- **09 Cliente**: "O cliente também sabe o que está acontecendo." — painel portal: Status Em andamento · Próximo passo Audiência · Documentos 2 pendentes · Última atualização hoje.
- **10 WhatsApp**: "Seu escritório não para quando você fecha o computador." — conversa realista (Cliente: "Tem alguma novidade?" → resposta curta citando movimentação + próximo passo).
- **11 Memória**: "Quanto mais você usa, mais o sistema entende como seu escritório trabalha." — SEU ESCRITÓRIO: Modelos · Teses · Preferências · Documentos · Workflows · Conhecimento (isolados por escritório).
- **12 Resultado**: "Menos operação. Mais advocacia." — ANTES: Pesquisar, Copiar, Organizar, Revisar, Responder, Acompanhar → DEPOIS: Analisar, Decidir, Revisar, Assinar. SEM métricas inventadas.
- **Segurança**: "Seus casos não são conteúdo para treinar um produto." — isolamento por escritório (RLS), permissões por equipe, auditoria de acesso, controle e exclusão de dados. (Afirmações reais do produto.)
- **CTA final**: "Deixe o sistema cuidar do resto." + botão primário + microtexto honesto.
- **Footer minimalista**: Jurídico IA · Produto · Recursos · Planos · Segurança · Contato · Termos · Privacidade.

Tom: frases curtas, poucos adjetivos, muito espaço. O produto fala como quem sabe muito e não precisa gritar.

## 7. Verdades do produto (não afirmar além)

Real e implementado: casos/fichas com contexto de IA, análise de processos, document intelligence, comparador, auditor de peças, advogado do contra, estrategista, pesquisa STJ com verificador de citações, workflows (Pro), auto-fill de modelos, radar jurídico/diário DJEN, calculadoras, command center ⌘K, triagem, portal do cliente, financeiro, assinatura, planos **Free R$0 / Pro R$149/mês** (Firm ainda NÃO existe como plano contratável — tratar como "para escritórios, em breve" sem preço).

## 8. Acessibilidade & qualidade

- `.marketing-root` no wrapper raiz da página (focus ring lacre + seleção já escopados no CSS).
- Contraste AA; nunca depender só de cor (✓/! acompanhados de texto).
- `aria-hidden` em todo ornamento; HTML semântico (h1 único no hero, h2 por seção); FAQ com `<details>` nativos navegáveis por teclado.
- Zero TODO/stub; zero emoji; Server Components por padrão, `"use client"` só onde há GSAP/interação.
- Ícones permitidos (únicos): `IconArrowRight, IconMenu, IconClose, IconCheck, IconPlus` de `./icons`.
