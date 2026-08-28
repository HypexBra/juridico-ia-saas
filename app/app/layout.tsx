import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { getAdminAtual } from "@/lib/admin/auth";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  // Nenhuma depende do resultado da outra (ambas leem o mesmo fast path de
  // headers injetado pelo middleware) — rodar em paralelo evita pagar dois
  // round-trips sequenciais em toda navegação dentro de /app.
  const [usuario, admin] = await Promise.all([getUsuarioAtual(), getAdminAtual()]);

  if (!usuario) {
    redirect("/login");
  }

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
