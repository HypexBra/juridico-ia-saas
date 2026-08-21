-- Auditor de Peças (Fase 4) — auditoria de peça processual (petição,
-- contestação, recurso) enviada por texto colado ou upload, com notas 0-10
-- por dimensão (fundamentação, coerência, pedidos, jurisprudência) e um
-- veredito de risco geral categórico (baixo/medio/alto). Distinta de
-- `analises_risco_contratual` (migration 0017, veredito por CLÁUSULA de
-- CONTRATO, não notas agregadas de peça) e de `analises_documento`
-- (migration 0033, resumo/classificação genérica sem pontuação). Ver
-- docs/adrs/0012-auditor-de-pecas.md, seção 1.
--
-- `ficha_caso_id` nullable segue o mesmo precedente de
-- `analises_risco_contratual`/`analises_documento`: auditar uma peça antes
-- de vincular a uma ficha aberta é fluxo válido, vínculo é conveniência
-- opcional.
--
-- `origem` como discriminador único (em vez de duas tabelas) mantém a
-- listagem/filtro numa consulta só; a constraint
-- `auditorias_peca_origem_consistente` impede dados inconsistentes
-- (ex.: `origem = 'colado'` com `nome_arquivo` preenchido) na origem, não só
-- na validação de aplicação.
create table if not exists auditorias_peca (
  id                    uuid primary key default gen_random_uuid(),
  escritorio_id         uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id         uuid references fichas_caso(id) on delete set null,
  origem                varchar(10) not null check (origem in ('colado', 'upload')),
  titulo                varchar(255),
  -- Preenchido só quando origem = 'colado' (mesmo padrão de
  -- analises_risco_contratual.texto_contrato_analisado, migration 0017).
  texto_peca_analisado  text,
  -- Preenchidos só quando origem = 'upload' (mesmo padrão de
  -- analises_documento, migration 0033).
  nome_arquivo          varchar(255),
  tipo_arquivo          varchar(10) check (tipo_arquivo in ('pdf', 'docx', 'imagem')),
  tamanho_bytes         integer,
  status                varchar(20) not null default 'processando'
                          check (status in ('processando', 'pronto', 'erro')),
  -- Estrutura de `ResultadoAuditoriaPeca` (`lib/auditoria-peca/tipos.ts`,
  -- entregue na Onda 1 do ADR 0012). `null` enquanto `status = 'processando'`.
  resultado_auditoria   jsonb,
  modelo_ia_usado       varchar(50),
  erro                  text,
  criado_por            uuid references perfis(id) on delete set null,
  criado_em             timestamptz not null default now(),
  processado_em         timestamptz,
  constraint auditorias_peca_origem_consistente check (
    (origem = 'colado' and texto_peca_analisado is not null and nome_arquivo is null)
    or
    (origem = 'upload' and nome_arquivo is not null and tipo_arquivo is not null
      and tamanho_bytes is not null and texto_peca_analisado is null)
  )
);
create index if not exists idx_auditorias_peca_escritorio on auditorias_peca(escritorio_id);
create index if not exists idx_auditorias_peca_ficha on auditorias_peca(ficha_caso_id);

alter table auditorias_peca enable row level security;
create policy "auditorias_peca_isolamento" on auditorias_peca
  for all using (escritorio_id = escritorio_atual());
