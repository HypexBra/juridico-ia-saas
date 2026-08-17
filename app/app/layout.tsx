import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { Sidebar } from "@/components/app/sidebar";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const usuario = await getUsuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nomeEscritorio={usuario.perfil.escritorio.nome}
        nomeUsuario={usuario.perfil.nome}
        role={usuario.perfil.role}
      />
      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
        <main className="flex-1 px-6 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
