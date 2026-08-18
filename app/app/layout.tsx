import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const usuario = await getUsuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  return (
    <AppShell
      nomeEscritorio={usuario.perfil.escritorio.nome}
      nomeUsuario={usuario.perfil.nome}
      role={usuario.perfil.role}
    >
      {children}
    </AppShell>
  );
}
