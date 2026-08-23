# ADR 0016 — Paleta unificada "papel-e-tinta" (landing + app interno)

Data: 2026-08-23 · Status: Aceito

## Contexto

A landing pública v3 adotou a direção editorial clara (papel `#faf9f5`, tinta
`#141412`, acento vermelho-lacre `#8b2e1f`) enquanto o app interno permanecia no
tema escuro navy (`#13294b`) com acento prata-metálico. O dono do produto
validou a direção da landing, mas pediu: **outra cor de acento** (o vermelho não
agradou) e **consistência visual entre landing e app** — "se a landing tem um
estilo/cor, dentro do app também precisa ter".

## Decisão

1. **Um único sistema visual para todo o produto**: papel-e-tinta editorial claro,
   com as MESMAS fontes em landing e app (Fraunces no display, Instrument Sans na
   interface, IBM Plex Mono para dados — Playfair e Inter removidos do carregamento).
2. **Novo acento: VERDE-SELO** `#1d5b46` (base), `#2f6f59` (secundário),
   `#e8efe9` (fundos pálidos), `#6fb594` (legível sobre tinta escura). Verde
   institucional profundo — remete a couro/biblioteca/gestão, distinto do
   vermelho rejeitado e do azul genérico de mercado; contraste AAA sobre papel.
3. **Migração por REMAPEAMENTO DE VALOR, não por rewrite**: as variáveis
   históricas do app (`navy/ice/silver/muted/green`) preservaram os NOMES e
   mudaram os VALORES para a paleta clara. Os ~140 arquivos que usam
   `bg-navy-2`/`text-ice`/`text-silver` migraram sem nenhum churn de diff; os
   nomes são documentados no `globals.css` como aliases históricos.
4. **Hardcodes varridos por frentes paralelas com posse exclusiva de arquivos**:
   `border-white/x → border-ink/10`, sombras duras → suaves ink-based,
   status claros `-300/-400` → escala 700/800 AA sobre papel, overlays
   `bg-black/60 → bg-ink/40`.
5. **Tokens editoriais renomeados** (`lacre/lacre-bright → accent/accent-bright`)
   apenas na landing para não mentir sobre o tom.

## Consequências

- Trocar o acento no futuro = alterar ~10 linhas em `globals.css`.
- `themeColor` do navegador passa a ser o papel (`#faf9f5`) — tema global único.
- Remoção de Playfair+Inter reduz bytes de fonte por visita (Fase 28).
- Componentes novos DEVEM usar os tokens (paper/ink/accent ou os aliases) —
  hardcode de white/black é sinal de regressão do sistema.

## Alternativas descartadas

- **App permanece escuro** com só o acento trocado: não atende ao pedido explícito
  de consistência estilo/cor entre landing e app.
- **Rewrite das classes dos 140 arquivos** para nomes semânticos novos: diff
  gigante e risco alto às vésperas do merge staging→main, sem ganho funcional.
- **Bordô/vinho como acento**: parente demais do vermelho já rejeitado.
