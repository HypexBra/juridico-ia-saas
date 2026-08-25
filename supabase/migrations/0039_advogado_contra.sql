-- Advogado do Contra (Fase 5) — a IA assume a perspectiva da parte
-- adversária de uma tese/petição e produz argumentos contrários,
-- fragilidades, contradições, precedentes contrários PROVÁVEIS (hipótese da
-- IA, nunca citação jurídica verificada — pesquisa jurídica com fonte real é
-- fase futura separada), pontos que precisam de prova, perguntas difíceis
-- que um julgador poderia fazer e recomendações de reforço. Estruturalmente
-- espelha `auditorias_peca` (migration 0035), mas SEM notas 0-10 por
-- dimensão nem veredito de risco categórico agregado: é 100% achados
-- adversariais qualitativos, por isso a coluna de resultado tem nome/schema
-- próprios (`resultado_advogado_contra`), não reuso de `resultado_auditoria`.
-- Ver docs/adrs/0013-advogado-do-contra.md.
--
-- `ficha_caso_id` nullable segue o mesmo precedente de `auditorias_peca`:
-- rodar o Advogado do Contra antes de vincular a uma ficha aberta é fluxo
-- válido, vínculo é conveniência opcional.
--
-- `tese_caso_id` é o campo novo em relação ao Auditor: a Fase 5 permite que a
-- entrada seja uma tese já cadastrada em `teses_caso` (Fase 1, migration
-- 0025), além de colar texto/upload — por isso `origem` ganha uma 3ª opção
-- (`tese_cadastrada`) e a constraint de consistência cobre 3 ramos em vez de
-- 2. `on delete set null`: apagar a tese não deve apagar a análise já
-- gerada, mesmo racional de `ficha_caso_id`.
create table if not exists analises_advogado_contra (
  id                    uuid primary key default gen_random_uuid(),
  escritorio_id         uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id         uuid references fichas_caso(id) on delete set null,
  tese_caso_id          uuid references teses_caso(id) on delete set null,
  origem                varchar(20) not null check (origem in ('colado', 'upload', 'tese_cadastrada')),
  titulo                varchar(255),
  -- Preenchido só quando origem = 'colado' (mesmo padrão de
  -- auditorias_peca.texto_peca_analisado, migration 0035).
  texto_peca_analisado  text,
  -- Preenchidos só quando origem = 'upload' (mesmo padrão de
  -- auditorias_peca, migration 0035).
  nome_arquivo          varchar(255),
  tipo_arquivo          varchar(10) check (tipo_arquivo in ('pdf', 'docx', 'imagem')),
  tamanho_bytes         integer,
  status                varchar(20) not null default 'processando'
                          check (status in ('processando', 'pronto', 'erro')),
  -- Estrutura de resultado a ser definida na próxima onda (`ai-engineer`,
  -- `lib/advogado-contra/tipos.ts`) — achados adversariais qualitativos, sem
  -- pontuação numérica agregada. `null` enquanto `status = 'processando'`.
  resultado_advogado_contra jsonb,
  modelo_ia_usado       varchar(50),
  erro                  text,
  criado_por            uuid references perfis(id) on delete set null,
  criado_em             timestamptz not null default now(),
  processado_em         timestamptz,
  constraint analises_advogado_contra_origem_consistente check (
    (origem = 'colado' and texto_peca_analisado is not null and nome_arquivo is null
      and tipo_arquivo is null and tamanho_bytes is null and tese_caso_id is null)
    or
    (origem = 'upload' and nome_arquivo is not null and tipo_arquivo is not null
      and tamanho_bytes is not null and texto_peca_analisado is null and tese_caso_id is null)
    or
    (origem = 'tese_cadastrada' and tese_caso_id is not null and texto_peca_analisado is null
      and nome_arquivo is null and tipo_arquivo is null and tamanho_bytes is null)
  )
);
create index if not exists idx_analises_advogado_contra_escritorio on analises_advogado_contra(escritorio_id);
create index if not exists idx_analises_advogado_contra_ficha on analises_advogado_contra(ficha_caso_id);
create index if not exists idx_analises_advogado_contra_tese on analises_advogado_contra(tese_caso_id);

alter table analises_advogado_contra enable row level security;
create policy "analises_advogado_contra_isolamento" on analises_advogado_contra
  for all using (escritorio_id = escritorio_atual());
