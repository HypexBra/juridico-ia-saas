-- Ajustes de schema para o fluxo de aplicação do portal do cliente:
-- (1) convite/ativação via RPC security definer (evita expor UPDATE direto
-- de `clientes_portal` a um usuário ainda sem `auth_user_id` vinculado —
-- nenhuma policy de 0003 permite isso, e não há service_role key
-- configurada no projeto para contornar via admin client);
-- (2) notificação automática ao cliente quando um prazo da ficha dele muda,
-- via trigger — evita precisar editar `app/app/prazos/actions.ts`, que pode
-- estar sendo alterado por outro agente em paralelo;
-- (3) relaxamento da constraint UNIQUE(email) de `clientes_portal`, que na
-- prática impede um mesmo cliente (mesmo e-mail) ter mais de uma ficha/caso
-- no mesmo escritório — a chave de negócio real é 1 convite por FICHA, não
-- por e-mail (um mesmo auth_user_id pode ficar vinculado a várias linhas de
-- `clientes_portal`, uma por caso — é exatamente o que
-- `ficha_ids_do_cliente_portal()` já pressupõe ao retornar `setof uuid`).

-- ── 1. Uma linha de convite por ficha, não por e-mail ───────────────────
alter table clientes_portal drop constraint if exists clientes_portal_email_key;
create unique index if not exists ux_clientes_portal_ficha on clientes_portal(ficha_caso_id);
create index if not exists idx_clientes_portal_token on clientes_portal(token_convite)
  where token_convite is not null;

-- ── 2. RPC: consultar convite (chamável sem sessão, antes do signUp) ───
-- Retorna só o mínimo necessário para a tela de ativação (nome/e-mail para
-- exibição + validade) — nunca o token nem o id interno.
create or replace function consultar_convite_cliente_portal(p_token text)
returns table (nome text, email text, valido boolean)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    cp.nome,
    cp.email,
    (cp.auth_user_id is null and cp.convite_expira_em is not null and cp.convite_expira_em > now()) as valido
  from clientes_portal cp
  where cp.token_convite = p_token
  limit 1
$$;
grant execute on function consultar_convite_cliente_portal(text) to anon, authenticated;

-- ── 3. RPC: ativar convite (exige sessão autenticada — chamada logo após
-- o signUp, ou no primeiro login pós-confirmação de e-mail) ────────────
-- Revalida tudo de novo no servidor (nunca confia na tela de ativação):
-- token existe, ainda não foi usado (`auth_user_id is null`) e não expirou.
-- security definer para poder fazer o UPDATE mesmo sem nenhuma policy de
-- `clientes_portal` cobrir esse caso (o usuário ainda não é "dono" da linha
-- do ponto de vista de RLS até este exato UPDATE rodar).
create or replace function ativar_convite_cliente_portal(p_token text)
returns table (id uuid, ficha_caso_id uuid, nome text, email text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_ficha_caso_id uuid;
  v_nome text;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select cp.id, cp.ficha_caso_id, cp.nome, cp.email
  into v_id, v_ficha_caso_id, v_nome, v_email
  from clientes_portal cp
  where cp.token_convite = p_token
    and cp.auth_user_id is null
    and cp.convite_expira_em is not null
    and cp.convite_expira_em > now()
  limit 1;

  if v_id is null then
    raise exception 'invite_invalid_or_expired' using errcode = 'P0001';
  end if;

  update clientes_portal
  set auth_user_id = auth.uid(), token_convite = null, convite_expira_em = null
  where clientes_portal.id = v_id;

  return query select v_id, v_ficha_caso_id, v_nome, v_email;
end;
$$;
grant execute on function ativar_convite_cliente_portal(text) to authenticated;

-- ── 4. Notificação automática ao cliente quando um prazo da ficha muda ──
-- Roda para QUALQUER caminho que grave em `prazos` (server action manual,
-- futura sincronização DJEN, importação em lote) — não depende de nenhum
-- arquivo de aplicação lembrar de chamar um helper.
create or replace function notificar_cliente_portal_sobre_prazo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente_portal_id uuid;
  v_mensagem text;
begin
  if NEW.ficha_caso_id is null then
    return NEW;
  end if;

  select cp.id into v_cliente_portal_id
  from clientes_portal cp
  where cp.ficha_caso_id = NEW.ficha_caso_id
    and cp.auth_user_id is not null
  limit 1;

  if v_cliente_portal_id is null then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    v_mensagem := 'Novo prazo cadastrado no seu caso: "' || NEW.titulo || '", com vencimento em '
      || to_char(NEW.data_prazo, 'DD/MM/YYYY') || '.';
    insert into notificacoes_cliente (escritorio_id, cliente_portal_id, ficha_caso_id, tipo, mensagem, enviada_em)
    values (NEW.escritorio_id, v_cliente_portal_id, NEW.ficha_caso_id, 'prazo_criado', v_mensagem, now());

  elsif TG_OP = 'UPDATE' then
    if NEW.concluido and not OLD.concluido then
      v_mensagem := 'Prazo concluído no seu caso: "' || NEW.titulo || '".';
      insert into notificacoes_cliente (escritorio_id, cliente_portal_id, ficha_caso_id, tipo, mensagem, enviada_em)
      values (NEW.escritorio_id, v_cliente_portal_id, NEW.ficha_caso_id, 'prazo_concluido', v_mensagem, now());
    elsif NEW.data_prazo is distinct from OLD.data_prazo then
      v_mensagem := 'O prazo "' || NEW.titulo || '" foi remarcado para '
        || to_char(NEW.data_prazo, 'DD/MM/YYYY') || '.';
      insert into notificacoes_cliente (escritorio_id, cliente_portal_id, ficha_caso_id, tipo, mensagem, enviada_em)
      values (NEW.escritorio_id, v_cliente_portal_id, NEW.ficha_caso_id, 'prazo_atualizado', v_mensagem, now());
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_notificar_cliente_portal_prazo on prazos;
create trigger trg_notificar_cliente_portal_prazo
  after insert or update on prazos
  for each row execute function notificar_cliente_portal_sobre_prazo();
