-- Achado de revisão de segurança sobre a migration 0038 (conta de equipe):
-- a policy `convites_equipe_aceitar_proprio` (WITH CHECK só valida
-- `status = 'aceito'` e o e-mail do JWT) não impede o PRÓPRIO convidado de
-- alterar `role`/`escritorio_id`/`nome`/`email` no mesmo UPDATE usado para
-- aceitar o convite — ex.: `.update({status:'aceito', role:'admin'})`.
--
-- Rastreado ponta a ponta: hoje isso NÃO vira escalação de privilégio, só
-- autossabotagem (`perfis_insert`, migration 0038, exige o convite ainda
-- `status='pendente'` no momento do aceite — a própria adulteração já
-- consome esse estado). Mas é uma garantia frágil (efeito colateral de
-- outra policy, não da própria), então qualquer alteração futura no fluxo
-- de aceite poderia reabrir a escalação sem ninguém perceber. Trigger
-- torna os campos sensíveis IMUTÁVEIS depois de criados — nem o próprio
-- convidado nem nenhum caminho futuro de código consegue contorná-la:
-- só `status`/`aceito_em` podem mudar num UPDATE (cancelamento pelo
-- gestor ou aceite pelo convidado); mudar escopo/papel de um convite exige
-- cancelar e criar um novo, nunca um UPDATE.
create or replace function impedir_alteracao_campos_convite_equipe()
returns trigger
language plpgsql
as $$
begin
  if new.escritorio_id <> old.escritorio_id
    or new.role <> old.role
    or lower(new.email) <> lower(old.email)
    or new.nome <> old.nome
    or new.criado_por <> old.criado_por
  then
    raise exception 'convites_equipe: escritorio_id/role/email/nome/criado_por sao imutaveis apos criado (cancele e crie um novo convite)';
  end if;
  return new;
end;
$$;

create trigger trg_convites_equipe_campos_imutaveis
  before update on convites_equipe
  for each row
  execute function impedir_alteracao_campos_convite_equipe();
