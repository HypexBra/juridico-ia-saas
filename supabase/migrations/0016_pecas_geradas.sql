-- Redação assistida de peças completas (feature premium "redacao_assistida_pecas",
-- ver lib/planos/gating.ts) — evolução do mail-merge de `peticoes_geradas`
-- (0010): aquela tabela registra uma SUBSTITUIÇÃO de variáveis literais num
-- modelo estático; esta guarda uma MINUTA COMPLETA redigida pela IA a partir
-- dos fatos da ficha (petição inicial, contestação, recurso, parecer etc),
-- sem modelo/template envolvido. Tabelas separadas de propósito: naturezas de
-- auditoria diferentes (`variaveis_usadas` jsonb vs. `conteudo_gerado` text
-- longo) e features de plano diferentes (mail-merge é free, isto é Pro).
create table if not exists pecas_geradas (
  id              uuid primary key default gen_random_uuid(),
  escritorio_id   uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id   uuid references fichas_caso(id) on delete set null,
  tipo_peca       varchar(30) not null
    check (tipo_peca in ('peticao_inicial', 'contestacao', 'recurso', 'parecer')),
  -- Instruções extras que o advogado digitou no momento da geração (ex: "foque
  -- em dano moral", "cliente pede tutela de urgência") — guardadas à parte dos
  -- dados da ficha para permitir auditar/reproduzir exatamente o que foi
  -- pedido à IA, sem duplicar o prompt inteiro (que é sempre reconstruível a
  -- partir da ficha + este campo + tipo_peca).
  instrucoes_extras text,
  conteudo_gerado text not null,
  -- Nome do modelo que efetivamente respondeu (Gemini ou, em fallback de
  -- quota, Groq — ver lib/ia/provider.ts) para auditoria/depuração de
  -- qualidade e para dar transparência ao advogado sobre a origem do texto.
  modelo_ia_usado varchar(50) not null,
  criado_por      uuid references perfis(id) on delete set null,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_pecas_geradas_escritorio on pecas_geradas(escritorio_id);
create index if not exists idx_pecas_geradas_ficha on pecas_geradas(ficha_caso_id);

alter table pecas_geradas enable row level security;
create policy "pecas_geradas_isolamento" on pecas_geradas
  for all using (escritorio_id = escritorio_atual());
