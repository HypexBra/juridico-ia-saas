-- Análise de risco contratual clause-by-clause / "redline" (feature Pro
-- "analise_risco_contratual", ver lib/planos/gating.ts) — diferente do score
-- de risco de UM CASO inteiro (`fichas_caso.nivel_risco`, migration 0008),
-- aqui a IA analisa um CONTRATO cláusula por cláusula e aponta problemas
-- (cláusula abusiva/ambígua/desequilibrada) com veredito individual.
--
-- `ficha_caso_id` é NULLABLE de propósito: a análise pode ser feita de forma
-- AVULSA (usuário só cola o texto de um contrato pra revisar, sem que exista
-- necessariamente uma ficha de caso aberta para ele — ex: due diligence antes
-- de aceitar um cliente novo). A v1 do produto (`app/app/redline/`) nem
-- oferece a opção de vincular a uma ficha ainda; a coluna já existe para não
-- exigir uma migration nova quando esse vínculo for implementado.
create table if not exists analises_risco_contratual (
  id                       uuid primary key default gen_random_uuid(),
  escritorio_id            uuid not null references escritorios(id) on delete cascade,
  ficha_caso_id            uuid references fichas_caso(id) on delete set null,
  -- Título/identificação livre do documento analisado (ex: "Contrato de
  -- prestação de serviços — Cliente X"), informado pelo usuário no momento
  -- do envio. Sem constraint de not null: identificar o documento é
  -- conveniência para o usuário reconhecer a análise depois, não requisito.
  titulo                   varchar(200),
  texto_contrato_analisado text not null,
  -- Estrutura de `lib/redline/tipos.ts#ResultadoAnaliseRisco`
  -- ({ clausulas: [...], resumoGeral, quantidadeRiscoAlto }) — jsonb (não
  -- colunas separadas) porque é a saída estruturada da IA, de tamanho e
  -- forma variáveis por documento, e nunca é filtrada/agregada via SQL hoje.
  resultado_analise        jsonb not null,
  modelo_ia_usado          varchar(50) not null,
  criado_por               uuid references perfis(id) on delete set null,
  criado_em                timestamptz not null default now()
);
create index if not exists idx_analises_risco_contratual_escritorio on analises_risco_contratual(escritorio_id);
create index if not exists idx_analises_risco_contratual_ficha on analises_risco_contratual(ficha_caso_id);

alter table analises_risco_contratual enable row level security;
create policy "analises_risco_contratual_isolamento" on analises_risco_contratual
  for all using (escritorio_id = escritorio_atual());
