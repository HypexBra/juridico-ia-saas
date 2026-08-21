import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { getAdminAtual } from "@/lib/admin/auth";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const usuario = await getUsuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  const admin = await getAdminAtual();

  return (
    <AppShell
      nomeEscritorio={usuario.perfil.escritorio.nome}
      nomeUsuario={usuario.perfil.nome}
      role={usuario.perfil.role}
      isAdminPlataforma={admin !== null}
    >
      {children}
    </AppShell>
  );
}
