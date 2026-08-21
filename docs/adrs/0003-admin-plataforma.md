# ADR 0003 — Admin da plataforma (cross-tenant), separado do `perfis.role`

## Contexto

O produto é multi-tenant: cada `escritorio` é um cliente do SaaS, e
`perfis.role` (`owner`/`admin`/`advogado`) já existe mas é escopado por
escritório via `escritorio_atual()` — um "admin" de um escritório não
enxerga nada de outro. O pedido de painel administrativo é para um papel
diferente: o operador do próprio SaaS (nós), que precisa ver/gerenciar
todos os escritórios, usuários e conversas.

## Decisão

1. **Tabela nova `plataforma_admins`**, fora de `escritorios`, com
   `auth_user_id` único. Não reaproveita `perfis.role` — evitaria confundir
   "admin do escritório X" com "admin do SaaS inteiro", e um escritório
   malicioso/comprometido nunca teria como se autopromover a admin da
   plataforma só criando um perfil com `role = 'admin'`.
2. **Autorização reforçada no banco, não só na aplicação.** Função
   `eh_admin_plataforma()` (security definer, igual padrão de
   `escritorio_atual()`) e policies RLS adicionais (permissivas, somadas às
   já existentes) em `escritorios`, `perfis`, `conversas`, `mensagens`,
   `assinaturas`. O client usado pelas actions de `/admin` continua sendo o
   client normal (sessão do usuário) — não o `service_role` — porque a RLS
   já faz o gate; menos superfície pra um bug de aplicação vazar dado
   cross-tenant.
3. **`service_role` só onde a RLS não alcança**: excluir de fato a conta em
   `auth.users` (não só o `perfis`) exige a Admin API do Supabase Auth, que
   só funciona com `SUPABASE_SERVICE_ROLE_KEY`. Enquanto essa env var não
   existir em produção, "excluir usuário" remove/anonimiza a linha de
   `perfis` (preserva conversas/histórico via `on delete set null`) mas
   deixa o `auth.users` órfão — ver `lib/admin/usuarios.ts`.
4. **Trigger de proteção contra remover o último admin** — no banco
   (`impedir_remocao_ultimo_admin`), não só na aplicação, porque é o tipo de
   invariante que não pode depender de nenhuma UI lembrar de checar.

## Bootstrap do primeiro admin

Como toda mutação em `plataforma_admins` exige `eh_admin_plataforma()` já
ser verdadeiro para quem está fazendo a chamada, o primeiro admin não pode
se auto-cadastrar pela aplicação (galinha e ovo, de propósito — impede
qualquer usuário comum de virar admin sozinho). Insira manualmente pelo
SQL Editor do Supabase (usa privilégio de superusuário, ignora RLS):

```sql
-- 1. Ache o auth_user_id do seu usuário (mesmo e-mail do login no app):
select id, email from auth.users where email = 'seu-email@dominio.com';

-- 2. Insira você mesmo como primeiro admin da plataforma:
insert into plataforma_admins (auth_user_id, nome, email)
values ('<uuid retornado acima>', 'Seu Nome', 'seu-email@dominio.com');
```

Depois do primeiro admin existir, novos admins podem ser adicionados pela
própria tela `/admin/administradores`.

## Consequências

- Nenhuma tabela/policy existente foi removida — só a policy
  `conversas_isolamento` (antes `for all`) foi dividida em policies por
  comando, para restringir DELETE ao autor (`criado_por`) sem alterar o
  comportamento colaborativo existente de SELECT/INSERT/UPDATE por
  escritório.
- Painel admin não depende de `SUPABASE_SERVICE_ROLE_KEY` para nenhuma
  funcionalidade de leitura/gestão — só a exclusão "de verdade" da conta de
  auth (fast-follow natural quando a env var existir).
