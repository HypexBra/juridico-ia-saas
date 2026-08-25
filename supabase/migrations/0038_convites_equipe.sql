-- Conta de equipe por escritório (feature nunca implementada de fato —
-- `convidarAction` só mostrava "ainda não disponível"; cada pessoa que se
-- cadastrava sozinha sempre criava um escritório NOVO como owner, então um
-- escritório com vários advogados nunca ficava de fato no MESMO tenant).
--
-- Fluxo: owner/admin cria um convite aqui + dispara
-- `auth.admin.inviteUserByEmail` (Supabase Auth já envia o e-mail — mesmo
-- mecanismo comprovado em produção por `redefinirSenhaUsuarioAction`, sem
-- precisar de um provedor de e-mail transacional à parte). O convidado
-- define senha em /auth/definir-senha e, no primeiro login,
-- `lib/app/current-user.ts` cria o `perfis` dele JUNTANDO o escritório do
-- convite (em vez do onboarding normal, que cria um escritório novo).
create table if not exists convites_equipe (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  email         varchar(255) not null,
  -- Nome informado pelo convidante (o convidado ainda não tem conta pra
  -- preencher o próprio nome) — vira `perfis.nome` no aceite.
  nome          varchar(255) not null,
  -- Nunca 'owner' por convite — só o onboarding normal (cadastro direto)
  -- cria um owner, e só há um por escritório em qualquer momento razoável.
  role          varchar(20) not null check (role in ('admin', 'advogado')),
  status        varchar(20) not null default 'pendente' check (status in ('pendente', 'aceito', 'cancelado', 'expirado')),
  criado_por    uuid not null references perfis(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  expira_em     timestamptz not null default (now() + interval '7 days'),
  aceito_em     timestamptz
);

create index if not exists idx_convites_equipe_escritorio on convites_equipe(escritorio_id);
-- Nunca dois convites pendentes pro mesmo e-mail no mesmo escritório.
create unique index if not exists idx_convites_equipe_email_pendente
  on convites_equipe (escritorio_id, lower(email))
  where status = 'pendente';

alter table convites_equipe enable row level security;

-- Owner/admin do escritório gerenciam convites do PRÓPRIO escritório (mesmo
-- padrão de `perfis_update_admin`).
create policy "convites_equipe_gestor" on convites_equipe
  for all using (
    escritorio_id = escritorio_atual()
    and exists (
      select 1 from perfis p
      where p.auth_user_id = auth.uid() and p.escritorio_id = convites_equipe.escritorio_id
        and p.role in ('owner', 'admin')
    )
  )
  with check (
    escritorio_id = escritorio_atual()
    and exists (
      select 1 from perfis p
      where p.auth_user_id = auth.uid() and p.escritorio_id = convites_equipe.escritorio_id
        and p.role in ('owner', 'admin')
    )
  );

-- O PRÓPRIO convidado (ainda sem perfil, `escritorio_atual()` é null) só
-- pode ENXERGAR e ACEITAR (marcar como aceito) o convite pendente e válido
-- para o e-mail da sessão dele — nunca ler/mudar convite de outra pessoa.
-- `auth.jwt() ->> 'email'` evita depender de select em `auth.users`.
create policy "convites_equipe_select_proprio" on convites_equipe
  for select using (
    status = 'pendente' and expira_em > now() and lower(email) = lower(auth.jwt() ->> 'email')
  );

create policy "convites_equipe_aceitar_proprio" on convites_equipe
  for update using (
    status = 'pendente' and expira_em > now() and lower(email) = lower(auth.jwt() ->> 'email')
  )
  with check (
    status = 'aceito' and lower(email) = lower(auth.jwt() ->> 'email')
  );

-- Fecha o gap de segurança que este fluxo expôs: antes, `perfis_insert` só
-- checava `auth_user_id = auth.uid()` — QUALQUER usuário autenticado sem
-- perfil ainda podia inserir uma linha em `perfis` com `role = 'owner'` e
-- `escritorio_id` de QUALQUER escritório já existente (escalada de
-- privilégio cross-tenant, nunca explorada mas sempre possível). Agora só
-- passa em dois casos: (1) cadastro normal criando o PRÓPRIO escritório
-- como primeiro/único owner, ou (2) aceite de convite pendente e válido
-- para o e-mail da sessão, no escritório/role exatos do convite.
drop policy if exists "perfis_insert" on perfis;
create policy "perfis_insert" on perfis
  for insert with check (
    auth_user_id = auth.uid()
    and (
      (role = 'owner' and not exists (select 1 from perfis p2 where p2.escritorio_id = perfis.escritorio_id))
      or exists (
        select 1 from convites_equipe c
        where c.escritorio_id = perfis.escritorio_id
          and c.role = perfis.role
          and c.status = 'pendente'
          and c.expira_em > now()
          and lower(c.email) = lower(auth.jwt() ->> 'email')
      )
    )
  );
