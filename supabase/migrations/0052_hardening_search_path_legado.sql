-- Continuação do hardening de 0049 (funções SECURITY DEFINER sem
-- `search_path` fixo são vulneráveis a search_path hijacking — CIS
-- PostgreSQL Benchmark / Supabase Security Advisor). 0049 cobriu só
-- `escritorio_atual()`/`eh_admin_plataforma()`; achado de auditoria desta
-- sessão (revisão do RAG híbrido, 0050/0051) apontou que o resto do schema
-- ficou com o mesmo gap. `create or replace function` reaplica a MESMA
-- lógica de cada função, só adicionando `set search_path` — nenhum
-- comportamento muda.

create or replace function limpar_chunks_da_fonte(p_fonte_tipo varchar, p_fonte_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from embeddings_chunks where fonte_tipo = p_fonte_tipo and fonte_id = p_fonte_id;
$$;

-- Última versão de `buscar_chunks_similares` era a de 0037 (boost de
-- recência) — reaplicada aqui só com o `search_path` adicionado.
create or replace function buscar_chunks_similares(
  p_escritorio_id uuid,
  p_query_embedding vector(768),
  p_match_count int default 6,
  p_fonte_tipos varchar[] default null
)
returns table (
  id uuid,
  fonte_tipo varchar,
  fonte_id uuid,
  conteudo text,
  metadata jsonb,
  distancia float
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    ec.id,
    ec.fonte_tipo,
    ec.fonte_id,
    ec.conteudo,
    ec.metadata,
    ec.embedding <=> p_query_embedding as distancia
  from embeddings_chunks ec
  where (ec.escritorio_id = p_escritorio_id or ec.escritorio_id is null)
    and (p_fonte_tipos is null or ec.fonte_tipo = any(p_fonte_tipos))
  order by
    (ec.embedding <=> p_query_embedding)
      - (0.03 * exp(-extract(epoch from (now() - ec.criado_em)) / (180.0 * 86400)))
  limit greatest(p_match_count, 1)
$$;

create or replace function ficha_ids_do_cliente_portal()
returns setof uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select ficha_caso_id from clientes_portal where auth_user_id = auth.uid()
$$;

create or replace function perfil_atual()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select id from perfis where auth_user_id = auth.uid()
$$;

create or replace function selecionar_e_registrar_uso_chave(p_provider varchar)
returns setof ia_provider_chaves
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chave ia_provider_chaves%rowtype;
begin
  select *
    into v_chave
    from ia_provider_chaves
   where provider = p_provider
     and status = 'ativa'
     and disponivel_em <= now()
   order by ultima_utilizada_em asc nulls first
     for update skip locked
   limit 1;

  if not found then
    return;
  end if;

  if v_chave.contador_janela_inicio <= now() - interval '60 seconds' then
    v_chave.contador_janela_inicio := now();
    v_chave.contador_requisicoes := 0;
  end if;

  if v_chave.contador_requisicoes >= v_chave.rpm_limite then
    return;
  end if;

  update ia_provider_chaves
     set contador_janela_inicio = v_chave.contador_janela_inicio,
         contador_requisicoes = v_chave.contador_requisicoes + 1,
         ultima_utilizada_em = now(),
         atualizado_em = now()
   where id = v_chave.id
  returning * into v_chave;

  return next v_chave;
end;
$$;

create or replace function registrar_falha_quota_chave_ia(p_chave_id uuid, p_motivo text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update ia_provider_chaves
     set status = 'desativada_temporariamente_por_quota',
         ultima_falha_em = now(),
         ultima_falha_motivo = p_motivo,
         disponivel_em = now() + interval '65 seconds',
         atualizado_em = now()
   where id = p_chave_id;
$$;
