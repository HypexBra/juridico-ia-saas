-- Proteção contra escritório sem nenhum owner ativo — backstop no banco
-- (mesmo padrão de `impedir_remocao_ultimo_admin`, migration 0014, mas
-- escopado por `escritorio_id` em vez de global).
--
-- Contexto (bug relatado: "colocar admin mostrou tudo misturado como se
-- fosse um grupo só"): a causa raiz foi confusão de UX entre `perfis.role`
-- (admin DO ESCRITÓRIO, já isolado por RLS via `escritorio_atual()`) e
-- `plataforma_admins` (admin DA PLATAFORMA, cross-tenant, ver ADR 0003) —
-- corrigido na aplicação (label do botão em /admin/usuarios). Este arquivo
-- é o complemento necessário para agora habilitar de fato a autoadministração
-- do escritório (`/app/equipe`: mudar role e ativar/desativar colegas), sem
-- deixar um escritório acidentalmente sem nenhum "owner" ativo — o que
-- travaria mudanças de plano/dados sensíveis que só o owner pode fazer
-- (ver policy `escritorios_update`).
create or replace function impedir_remocao_ultimo_owner_escritorio()
returns trigger
language plpgsql
as $$
declare
  restantes_ativos integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' and old.ativo then
      select count(*) into restantes_ativos
        from perfis
        where escritorio_id = old.escritorio_id and role = 'owner' and ativo and id <> old.id;
      if restantes_ativos = 0 then
        raise exception 'Não é possível remover o último administrador titular (owner) do escritório.';
      end if;
    end if;
    return old;
  end if;

  -- UPDATE: só bloqueia a transição que tiraria o escritório do último
  -- owner ativo (desativar o owner, ou trocar o role dele para outro).
  if old.role = 'owner' and old.ativo and (new.role <> 'owner' or not new.ativo) then
    select count(*) into restantes_ativos
      from perfis
      where escritorio_id = old.escritorio_id and role = 'owner' and ativo and id <> old.id;
    if restantes_ativos = 0 then
      raise exception 'Não é possível remover/desativar o último administrador titular (owner) do escritório.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_impedir_remocao_ultimo_owner_escritorio on perfis;
create trigger trg_impedir_remocao_ultimo_owner_escritorio
  before update or delete on perfis
  for each row execute function impedir_remocao_ultimo_owner_escritorio();
