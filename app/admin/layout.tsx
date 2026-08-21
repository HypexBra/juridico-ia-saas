import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { getAdminAtual } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Guard do painel admin (seção 2/11 do pedido): NUNCA confia só em esconder
 * o link na sidebar do app normal. Todo acesso a /admin (e a cada server
 * action chamada a partir daqui) passa por `getAdminAtual()`, que por sua
 * vez é reforçado por RLS no banco (ver docs/adrs/0003-admin-plataforma.md)
 * — usuário sem sessão vai pro login, usuário logado mas sem linha ativa em
 * `plataforma_admins` volta pro dashboard normal, sem nenhum dado
 * administrativo renderizado nem no HTML enviado ao client.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const admin = await getAdminAtual();
  if (!admin) redirect("/app/dashboard");

  return <AdminShell nomeAdmin={admin.admin.nome}>{children}</AdminShell>;
}
