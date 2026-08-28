-- Hardening: funções SECURITY DEFINER sem `search_path` fixo são
-- vulneráveis a search_path hijacking (CIS PostgreSQL Benchmark / Supabase
-- Security Advisor). Fixa o path para as duas funções auxiliares de RLS
-- usadas em praticamente toda policy do schema.

create or replace function escritorio_atual()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select escritorio_id from perfis where auth_user_id = auth.uid()
$$;

create or replace function eh_admin_plataforma()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from plataforma_admins where auth_user_id = auth.uid() and ativo
  )
$$;
